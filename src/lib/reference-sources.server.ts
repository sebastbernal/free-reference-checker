// Server-only helpers for reference verification.
// One function per source (CrossRef, Semantic Scholar, OpenAlex, arXiv, DBLP),
// plus web-link liveness + Wayback checks and title-similarity scoring.

const TIMEOUT = 15000;
const USER_AGENT =
  "RefChecker/1.0 (academic reference verification tool; mailto:noreply@example.com)";

// A real browser UA — some university / government sites block non-browser
// clients outright, which previously produced false "dead link" verdicts.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BROWSER_HEADERS = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const HEADERS = { "User-Agent": USER_AGENT, Accept: "application/json" };

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeout = TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------------------------------------------------------------------------
// Title similarity (ported from the original CheckIfExist tool)
// ---------------------------------------------------------------------------

export function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function wordOverlap(str1: string, str2: string): number {
  const w1 = str1
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const w2 = str2
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!w1.length || !w2.length) return 0;
  const s1 = new Set(w1);
  const s2 = new Set(w2);
  let inter = 0;
  for (const w of s1) if (s2.has(w)) inter++;
  const union = new Set([...s1, ...s2]).size;
  return union === 0 ? 0 : Math.round((inter / union) * 100);
}

export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const c1 = normalize(a);
  const c2 = normalize(b);
  if (c1 === c2) return 100;
  const dist = levenshtein(c1, c2);
  const maxLen = Math.max(c1.length, c2.length);
  const levenSim = maxLen === 0 ? 0 : Math.max(0, Math.round((1 - dist / maxLen) * 100));
  const wordSim = wordOverlap(a, b);
  let sim = Math.max(levenSim, wordSim);
  // If one title contains the other (e.g. cited text is a fuller citation)
  if (sim < 90 && c1.includes(c2) && c2.length > 20) sim = Math.max(sim, 90);
  if (sim < 90 && c2.includes(c1) && c1.length > 20) sim = Math.max(sim, 90);
  return sim;
}

// ---------------------------------------------------------------------------
// Source candidate shape
// ---------------------------------------------------------------------------

export interface Candidate {
  title: string;
  year?: string;
  doi?: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// CrossRef
// ---------------------------------------------------------------------------

export async function crossrefByDoi(doi: string): Promise<Candidate | null> {
  try {
    const r = await fetchWithTimeout(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return null;
    const data = (await r.json())?.message;
    if (!data) return null;
    return {
      title: (data.title || [""])[0] || "",
      year: String(data.published?.["date-parts"]?.[0]?.[0] ?? ""),
      doi: data.DOI,
      url: data.URL,
    };
  } catch {
    return null;
  }
}

export async function crossrefByTitle(title: string): Promise<Candidate[]> {
  try {
    const r = await fetchWithTimeout(
      `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=5`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return [];
    const items = (await r.json())?.message?.items ?? [];
    return items.map((d: any) => ({
      title: (d.title || [""])[0] || "",
      year: String(d.published?.["date-parts"]?.[0]?.[0] ?? ""),
      doi: d.DOI,
      url: d.URL,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// OpenAlex
// ---------------------------------------------------------------------------

export async function openAlexByDoi(doi: string): Promise<Candidate | null> {
  try {
    const r = await fetchWithTimeout(
      `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return null;
    const d = await r.json();
    if (!d?.title) return null;
    return { title: d.title, year: String(d.publication_year ?? ""), doi, url: d.id };
  } catch {
    return null;
  }
}

export async function openAlexByTitle(title: string): Promise<Candidate[]> {
  try {
    const r = await fetchWithTimeout(
      `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per_page=5`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return [];
    const results = (await r.json())?.results ?? [];
    return results.map((d: any) => ({
      title: d.title || "",
      year: String(d.publication_year ?? ""),
      doi: d.doi,
      url: d.id,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Semantic Scholar
// ---------------------------------------------------------------------------

export async function semanticScholarByTitle(title: string): Promise<Candidate[]> {
  try {
    const r = await fetchWithTimeout(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
        title,
      )}&fields=title,year,externalIds,url&limit=5`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return [];
    const data = (await r.json())?.data ?? [];
    return data.map((d: any) => ({
      title: d.title || "",
      year: String(d.year ?? ""),
      doi: d.externalIds?.DOI,
      url: d.url,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// arXiv (Atom XML)
// ---------------------------------------------------------------------------

export async function arxivByTitle(title: string): Promise<Candidate[]> {
  try {
    const r = await fetchWithTimeout(
      `https://export.arxiv.org/api/query?search_query=ti:${encodeURIComponent(
        `"${title}"`,
      )}&max_results=5`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (r.status !== 200) return [];
    const xml = await r.text();
    const entries = xml.split(/<entry>/).slice(1);
    return entries.map((e) => {
      const t = /<title>([\s\S]*?)<\/title>/.exec(e)?.[1] ?? "";
      const id = /<id>([\s\S]*?)<\/id>/.exec(e)?.[1] ?? "";
      const year = /<published>(\d{4})/.exec(e)?.[1] ?? "";
      return {
        title: t.replace(/\s+/g, " ").trim(),
        year,
        url: id.trim(),
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DBLP
// ---------------------------------------------------------------------------

export async function dblpByTitle(title: string): Promise<Candidate[]> {
  try {
    const r = await fetchWithTimeout(
      `https://dblp.org/search/publ/api?q=${encodeURIComponent(title)}&format=json&h=5`,
      { headers: HEADERS },
    );
    if (r.status !== 200) return [];
    const hits = (await r.json())?.result?.hits?.hit ?? [];
    return hits.map((h: any) => {
      const info = h.info ?? {};
      return {
        title: (info.title || "").replace(/\.$/, ""),
        year: String(info.year ?? ""),
        doi: info.doi,
        url: info.ee || info.url,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Web link liveness + Wayback
// ---------------------------------------------------------------------------

export async function httpCheck(url: string): Promise<string> {
  try {
    let r = await fetchWithTimeout(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (r.status === 405 || r.status >= 400) {
      r = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
    }
    return String(r.status);
  } catch (e) {
    return `error: ${(e as Error).name}`;
  }
}

export async function waybackCheck(url: string): Promise<string> {
  try {
    const r = await fetchWithTimeout(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { headers: HEADERS },
    );
    const snap = (await r.json())?.archived_snapshots?.closest;
    if (snap?.available) {
      return `snapshot exists (${String(snap.timestamp ?? "").slice(0, 4)})`;
    }
    return "NO snapshot ever";
  } catch (e) {
    return `error: ${(e as Error).name}`;
  }
}
