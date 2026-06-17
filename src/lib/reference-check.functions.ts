import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { parseReferences } from "./parse-references";
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
    const note = `AI-tool tracking parameter detected (${result.aiTrace}) — this citation was likely copied from an AI assistant. Verify the source manually.`;
    result.notes = result.notes ? `${result.notes} ${note}` : note;
    // An AI trace always warrants human review, even if the link/page resolves.
    if (result.verdict === "real" || result.verdict === "archived") {
      result.verdict = "check";
    }
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
    const http = await httpCheck(url);
    base.httpStatus = http.status;
    const code = Number(http.status);
    const year = detectContentYear(ref, url, http.lastModified);
    const outdated =
      year !== null && new Date().getFullYear() - year >= OUTDATED_AGE_YEARS;
    const agingNote = outdated
      ? ` The source looks dated (${year}) — confirm it hasn't been superseded by a newer version.`
      : "";

    // 1. Live page (2xx/3xx).
    if (!Number.isNaN(code) && code < 400) {
      if (outdated) {
        base.verdict = "check";
        base.notes = `Live page (HTTP ${code}), but it may be outdated.${agingNote}`;
      } else {
        base.verdict = "real";
        base.notes = `Live page (HTTP ${code}).`;
      }
      return base;
    }

    // 2. Server responded but blocked automated verification — the page exists.
    if (BLOCKED_CODES.has(code)) {
      base.verdict = "check";
      base.notes =
        `Server responded (HTTP ${code}) but blocked automated verification — ` +
        `the page likely exists, confirm manually.${agingNote}`;
      return base;
    }

    // 3. Network / timeout error: couldn't reach it, but that doesn't prove
    //    the page is fake — many sites block automated requests by IP.
    if (Number.isNaN(code)) {
      const wb = await waybackCheck(url);
      base.wayback = wb;
      base.verdict = "check";
      const archive = wb.startsWith("snapshot")
        ? ` An archived ${wb} exists.`
        : "";
      base.notes =
        `Couldn't reach the page from our server (${http.status}) — ` +
        `sites sometimes block automated requests. Verify manually.${archive}${agingNote}`;
      return base;
    }

    // 4. Genuine dead page (404/410/other ≥400): fall back to the archive.
    const wb = await waybackCheck(url);
    base.wayback = wb;
    if (wb.startsWith("snapshot")) {
      base.verdict = "archived";
      base.notes = `Dead link (HTTP ${http.status}), but an archived ${wb} exists.${agingNote}`;
    } else if (wb === "NO snapshot ever") {
      base.verdict = "no-trace";
      base.notes = `Unreachable (HTTP ${http.status}) and never archived. Possibly fabricated.`;
    } else {
      base.verdict = "inconclusive";
      base.notes = `Could not verify (HTTP ${http.status}, archive ${wb}).`;
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
          aiTrace: "",
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
