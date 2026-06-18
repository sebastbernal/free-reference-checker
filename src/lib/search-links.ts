// Build manual-search URLs for a reference that failed auto-verification.
// Pure URL construction — no API, no network from our side. The user clicks
// through in their own browser (normal human traffic, so no rate-limit concern).
export interface ManualSearchLinks {
  scholar: string;
  books: string;
  web: string;
  bing: string;
}

// Pull a concise query from the reference: prefer the cited title (quoted as a
// phrase), and add the first-author surname + year when available to
// disambiguate. Falls back to the whole reference if no title was extracted.
export function buildSearchLinks(
  ref: string,
  citedTitle: string,
): ManualSearchLinks {
  const title = (citedTitle || "").trim();

  // First-author surname: the leading word(s) before the first comma, if the
  // reference starts with a surname-style token.
  let author = "";
  const am = ref.match(/^([A-ZÀ-Þ][\wÀ-ÿ'’-]+)\s*,/);
  if (am) author = am[1];

  // Year: first (YYYY) or (n.d.).
  let year = "";
  const ym = ref.match(/\((\d{4})[a-z]?\)/);
  if (ym) year = ym[1];

  // Compose the query. Quote the title so it's treated as a phrase.
  let query = "";
  if (title) {
    query = `"${title}"`;
    if (author) query += ` ${author}`;
    if (year) query += ` ${year}`;
  } else {
    // No title parsed — use the reference text, trimmed of any trailing links.
    query = ref.replace(/\[link:[^\]]*\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
  }

  const q = encodeURIComponent(query);
  return {
    scholar: `https://scholar.google.com/scholar?q=${q}`,
    books: `https://openlibrary.org/search?q=${q}`,
    web: `https://duckduckgo.com/?q=${q}`,
    bing: `https://www.bing.com/search?q=${q}`,
  };
}
