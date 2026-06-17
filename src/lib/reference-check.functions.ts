import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  arxivByTitle,
  crossrefByDoi,
  crossrefByTitle,
  dblpByTitle,
  httpCheck,
  openAlexByDoi,
  openAlexByTitle,
  semanticScholarByTitle,
  titleSimilarity,
  waybackCheck,
  type Candidate,
} from "./reference-sources.server";

export type Verdict =
  | "real"
  | "check"
  | "archived"
  | "no-trace"
  | "offline"
  | "inconclusive";

export interface ReferenceResult {
  n: number;
  reference: string;
  type: "academic" | "web" | "offline";
  doi: string;
  url: string;
  citedTitle: string;
  matchedTitle: string;
  titleScore: number | null;
  source: string;
  httpStatus: string;
  wayback: string;
  verdict: Verdict;
  notes: string;
  aiTrace: string;
}

const MIN_TITLE_SIM = 70;
const MISMATCH_SIM = 50;
const CONCURRENCY = 4;
const MAX_REFERENCES = 100;

// ---------------------------------------------------------------------------
// STAGE 1: parse messy text into individual references
// ---------------------------------------------------------------------------

function parseReferences(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const cleaned = lines.map((ln) =>
    ln
      .replace(/\s*\[[^\]]*\|\s*Word\]\s*$/, "")
      .replace(/\s*\[[^\]]*\]\s*$/, "")
      .replace(/\s+$/, ""),
  );

  // The current reference looks finished: ends with a URL (web refs often have
  // no trailing period) or with sentence/paren-terminating punctuation.
  const endsComplete = (buffer: string): boolean => {
    // Collapse URLs split across lines so a wrapped URL still counts as a tail.
    const b = buffer
      .replace(/(https?:\/\/\S+)\s+([a-z0-9%][^\s]*)/g, "$1$2")
      .trim();
    if (!b) return false;
    if (/https?:\/\/\S+$/.test(b)) return true;
    return /[.)\]]$/.test(b);
  };

  // The line looks like the genuine start of an APA reference, not a wrapped
  // continuation (author lists, wrapped titles, split URLs).
  const looksLikeStart = (line: string): boolean => {
    const s = line.trim();
    if (!s) return false;
    const lower = s.toLowerCase();
    if (lower.startsWith("http") || lower.startsWith("www.") || lower.startsWith("doi"))
      return false;
    // numbered list markers: "1.", "[1]", "(1)"
    if (/^(\[\d+\]|\(\d+\)|\d+[.)])\s+/.test(s)) return true;
    // author pattern: "Surname, X."
    if (/^[A-Z][\w'’.-]*,\s+[A-Z]\./.test(s)) return true;
    // organization author with an early year token: "United Nations. (2015)."
    if (/^[A-Z].{0,80}?\((?:\d{4}[a-z]?|n\.d\.)\)/.test(s)) return true;
    return false;
  };

  const isNewEntry = (line: string, buffer: string): boolean =>
    endsComplete(buffer) && looksLikeStart(line);

  const entries: string[] = [];
  let current = "";
  for (const ln of cleaned) {
    const s = ln.trim();
    if (!s) continue;
    if (current && isNewEntry(ln, current)) {
      entries.push(current.trim());
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) entries.push(current.trim());

  return entries.map((e) =>
    e
      .replace(/(https?:\/\/\S+)\s+([a-z0-9%][^\s]*)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

// ---------------------------------------------------------------------------
// STAGE 2: classify + extract DOI / URL / cited title
// ---------------------------------------------------------------------------

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i;
const URL_RE = /https?:\/\/[^\s]+/i;
const YEAR_RE = /\((?:\d{4}[a-z]?|n\.d\.)\)/;

// Markers left in URLs when a citation is copied from an AI assistant's output.
const AI_TRACE_MARKERS = [
  "chatgpt.com",
  "chatgpt",
  "openai",
  "perplexity.ai",
  "perplexity",
  "google-gemini",
  "gemini",
  "bard",
  "anthropic",
  "claude",
  "copilot",
  "bingchat",
  "you.com",
  "poe.com",
];
const AI_TRACE_PARAM_RE = /(?:utm_source|utm_medium|source|ref)=([^\s&"')\]]+)/gi;

// Returns the matched marker (e.g. "utm_source=chatgpt.com") or "" when none.
function detectAiTrace(ref: string): string {
  const lower = ref.toLowerCase();
  let m: RegExpExecArray | null;
  AI_TRACE_PARAM_RE.lastIndex = 0;
  while ((m = AI_TRACE_PARAM_RE.exec(lower))) {
    const value = m[1];
    if (AI_TRACE_MARKERS.some((marker) => value.includes(marker))) {
      return m[0].replace(/[.,;)]+$/, "");
    }
  }
  return "";
}

function extract(ref: string): {
  kind: "academic" | "web" | "offline";
  doi: string;
  url: string;
} {
  const doiM = DOI_RE.exec(ref);
  const urlM = URL_RE.exec(ref);
  const doi = doiM ? doiM[0].replace(/[.,;)]+$/, "") : "";
  const url = urlM ? urlM[0].replace(/[.,;)]+$/, "") : "";
  // Treat DOI-bearing URLs as academic
  const isDoiUrl = /doi\.org/i.test(url) || /arxiv\.org/i.test(url);
  let kind: "academic" | "web" | "offline";
  if (doi) kind = "academic";
  else if (url && !isDoiUrl) kind = "web";
  else if (url && isDoiUrl) kind = "academic";
  else kind = "offline";
  return { kind, doi, url };
}

function extractCitedTitle(ref: string): string {
  let body = ref;
  const mu = URL_RE.exec(body);
  if (mu) body = body.slice(0, mu.index).trim();
  body = body.replace(DOI_RE, "").trim();

  const ym = YEAR_RE.exec(body);
  if (ym) {
    const after = body.slice(ym.index + ym[0].length).replace(/^[\s.]+/, "");
    let end: number | null = null;
    const re = /\.(?:\s|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(after))) {
      const j = m.index;
      // skip author initials like "J." (capital preceded by space)
      if (j >= 1 && /[A-Z]/.test(after[j - 1]) && (j < 2 || after[j - 2] === " "))
        continue;
      end = j;
      break;
    }
    return (end !== null ? after.slice(0, end) : after).trim();
  }
  // No year — heuristic: take the longest sentence-like chunk
  const parts = body.split(/[.]\s+/).filter((p) => p.length > 15);
  return (parts.sort((a, b) => b.length - a.length)[0] || body).trim();
}

// ---------------------------------------------------------------------------
// STAGE 3: academic verification across sources
// ---------------------------------------------------------------------------

interface AcademicOutcome {
  source: string;
  matchedTitle: string;
  titleScore: number | null;
}

async function bestFromCandidates(
  citedTitle: string,
  candidates: Candidate[],
): Promise<{ title: string; score: number } | null> {
  if (!citedTitle || !candidates.length) return null;
  let best: { title: string; score: number } | null = null;
  for (const c of candidates) {
    if (!c.title) continue;
    const score = titleSimilarity(citedTitle, c.title);
    if (!best || score > best.score) best = { title: c.title, score };
  }
  return best;
}

async function checkAcademic(
  doi: string,
  citedTitle: string,
): Promise<AcademicOutcome | null> {
  // 1. Direct DOI resolution (CrossRef then OpenAlex)
  if (doi) {
    const cr = await crossrefByDoi(doi);
    if (cr) {
      return {
        source: "CrossRef (DOI)",
        matchedTitle: cr.title,
        titleScore: citedTitle && cr.title ? titleSimilarity(citedTitle, cr.title) : null,
      };
    }
    const oa = await openAlexByDoi(doi);
    if (oa) {
      return {
        source: "OpenAlex (DOI)",
        matchedTitle: oa.title,
        titleScore: citedTitle && oa.title ? titleSimilarity(citedTitle, oa.title) : null,
      };
    }
    // DOI present but resolves nowhere -> caller flags as "not in databases"
  }

  // 2. Title search across sources, accept first strong match
  if (!citedTitle) return null;
  const sources: [string, () => Promise<Candidate[]>][] = [
    ["CrossRef", () => crossrefByTitle(citedTitle)],
    ["OpenAlex", () => openAlexByTitle(citedTitle)],
    ["Semantic Scholar", () => semanticScholarByTitle(citedTitle)],
    ["arXiv", () => arxivByTitle(citedTitle)],
    ["DBLP", () => dblpByTitle(citedTitle)],
  ];

  let bestOverall: AcademicOutcome | null = null;
  for (const [name, fn] of sources) {
    let cands: Candidate[] = [];
    try {
      cands = await fn();
    } catch {
      cands = [];
    }
    const best = await bestFromCandidates(citedTitle, cands);
    if (best) {
      if (best.score >= MIN_TITLE_SIM) {
        return { source: name, matchedTitle: best.title, titleScore: best.score };
      }
      if (!bestOverall || (best.score ?? 0) > (bestOverall.titleScore ?? 0)) {
        bestOverall = { source: name, matchedTitle: best.title, titleScore: best.score };
      }
    }
  }
  // No strong match; return the closest near-miss (caller decides verdict)
  return bestOverall;
}

// ---------------------------------------------------------------------------
// Per-reference processing
// ---------------------------------------------------------------------------

async function processReference(n: number, ref: string): Promise<ReferenceResult> {
  const result = await processReferenceCore(n, ref);
  if (result.aiTrace) {
    const note = `AI-tool tracking parameter detected (${result.aiTrace}) — this citation was likely generated by an AI assistant.`;
    result.notes = result.notes ? `${result.notes} ${note}` : note;
  }
  return result;
}

async function processReferenceCore(n: number, ref: string): Promise<ReferenceResult> {
  const { kind, doi, url } = extract(ref);
  const citedTitle = extractCitedTitle(ref);
  const aiTrace = detectAiTrace(ref);

  const base: ReferenceResult = {
    n,
    reference: ref,
    type: kind,
    doi,
    url,
    citedTitle,
    matchedTitle: "",
    titleScore: null,
    source: "",
    httpStatus: "",
    wayback: "",
    verdict: "inconclusive",
    notes: "",
    aiTrace,
  };

  if (kind === "academic") {
    const outcome = await checkAcademic(doi, citedTitle);
    if (outcome && (outcome.titleScore === null || outcome.titleScore >= MIN_TITLE_SIM)) {
      base.source = outcome.source;
      base.matchedTitle = outcome.matchedTitle;
      base.titleScore = outcome.titleScore;
      if (outcome.titleScore !== null && outcome.titleScore < MISMATCH_SIM) {
        base.verdict = "check";
        base.notes = `Found, but title mismatch (${outcome.titleScore}%) — verify it points to the cited work.`;
      } else if (outcome.titleScore !== null && outcome.titleScore < MIN_TITLE_SIM) {
        base.verdict = "check";
        base.notes = `Partial title match (${outcome.titleScore}%) — check manually.`;
      } else {
        base.verdict = "real";
        base.notes = `Confirmed in ${outcome.source}.`;
      }
      return base;
    }
    if (outcome) {
      // near miss only
      base.source = outcome.source;
      base.matchedTitle = outcome.matchedTitle;
      base.titleScore = outcome.titleScore;
      base.verdict = "check";
      base.notes = doi
        ? `DOI did not resolve; closest title match only ${outcome.titleScore}%. Possibly fabricated.`
        : `No strong match (closest ${outcome.titleScore}%). Possibly fabricated.`;
      return base;
    }
    base.verdict = "check";
    base.notes = doi
      ? "DOI not found in any database. Possibly fabricated."
      : "Not found in CrossRef, OpenAlex, Semantic Scholar, arXiv or DBLP. Possibly fabricated.";
    return base;
  }

  if (kind === "web") {
    const status = await httpCheck(url);
    base.httpStatus = status;
    const code = Number(status);
    if (!Number.isNaN(code) && code < 400) {
      base.verdict = "real";
      base.notes = `Live page (HTTP ${code}).`;
      return base;
    }
    const wb = await waybackCheck(url);
    base.wayback = wb;
    if (wb.startsWith("snapshot")) {
      base.verdict = "archived";
      base.notes = `Dead link (HTTP ${status}), but an archived ${wb} exists.`;
    } else if (wb === "NO snapshot ever") {
      base.verdict = "no-trace";
      base.notes = `Unreachable (HTTP ${status}) and never archived. Possibly fabricated.`;
    } else {
      base.verdict = "inconclusive";
      base.notes = `Could not verify (HTTP ${status}, archive ${wb}).`;
    }
    return base;
  }

  base.verdict = "offline";
  base.notes = "Offline source (e.g. a book) — cannot auto-verify.";
  return base;
}

async function runPool(refs: string[]): Promise<ReferenceResult[]> {
  const results: ReferenceResult[] = new Array(refs.length);
  let i = 0;
  async function worker() {
    while (i < refs.length) {
      const idx = i++;
      try {
        results[idx] = await processReference(idx + 1, refs[idx]);
      } catch (e) {
        results[idx] = {
          n: idx + 1,
          reference: refs[idx],
          type: "offline",
          doi: "",
          url: "",
          citedTitle: "",
          matchedTitle: "",
          titleScore: null,
          source: "",
          httpStatus: "",
          wayback: "",
          verdict: "inconclusive",
          notes: `Error: ${(e as Error).message}`,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, refs.length) }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

export const checkReferences = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string }) =>
    z.object({ text: z.string().min(1).max(100000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const refs = parseReferences(data.text).slice(0, MAX_REFERENCES);
    if (!refs.length) {
      return { results: [] as ReferenceResult[], parsed: 0 };
    }
    const results = await runPool(refs);
    return { results, parsed: refs.length };
  });
