// Shared client-safe reference parsing used by both the authenticity verifier
// and the citation-style formatting checker.

export function parseReferences(raw: string): string[] {
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

  return entries
    .flatMap(splitRunOn)
    .map((e) => mergeWrappedUrl(e.replace(/\s+/g, " ").trim()))
    .filter(Boolean);
}

// Rejoin a URL that wrapped across lines (now a space inside the URL). Word
// processors break long URLs at a hyphen and drop it, so the correct repair is
// to rejoin the fragments with "-", not to delete the space.
//
// A fragment after the space is only merged when it looks like a URL path
// piece: it contains "-" or "/", or it is entirely lowercase (a mid-word wrap).
// Fragments starting with sentence punctuation (e.g. "(Accessed…") are left
// alone so trailing prose after a URL isn't swallowed.
function mergeWrappedUrl(entry: string): string {
  // Fragment is either a path slug (contains "-" or "/", any leading case) or an
  // entirely lowercase mid-word wrap. A capitalized word with no "-"/"/" (e.g.
  // "City") is treated as the next reference's prose, not part of the URL.
  const re =
    /(https?:\/\/[^\s]+)\s+([A-Za-z0-9%][A-Za-z0-9%._~#?&=+/-]*[-/][A-Za-z0-9%._~#?&=+/-]*|[a-z0-9%][a-z0-9%._~#?&=+]*)/;
  let prev: string;
  let out = entry;
  do {
    prev = out;
    // If the URL fragment already ends with "-" (the word processor kept the
    // hyphen at the wrap point) don't add a second one — otherwise insert "-".
    out = out.replace(re, (_m, url: string, frag: string) =>
      `${url}${url.endsWith("-") ? "" : "-"}${frag}`,
    );
  } while (out !== prev);
  return out;
}

// A reference's date signature: "(2021, March 2)", "(2024)", "(n.d.)".
// Every APA entry begins with an author/org followed by one of these, so each
// occurrence after the first marks the start of a new reference.
const DATE_SIG = /\((?:\d{4}[a-z]?|n\.d\.)(?:,[^)]{0,40})?\)/g;

// A token that belongs to the PREVIOUS reference's URL / source rather than the
// next author: contains a URL marker, a digit, leads with lowercase, or is a
// slug-like fragment with 2+ internal hyphens (e.g. "Research-Collaboration-Project").
function isUrlish(token: string): boolean {
  if (/:\/\/|\/|www\.|\.(?:com|org|net|edu|gov|au|ch|uk|io|pdf|html?)\b/i.test(token))
    return true;
  if (/\d/.test(token)) return true;
  if (/^[a-z]/.test(token)) return true;
  if ((token.match(/-/g)?.length ?? 0) >= 2) return true;
  return false;
}

// Split a single run-on block (e.g. one-line PDF text) into individual
// references. Blocks with fewer than two date signatures are returned as-is.
function splitRunOn(entry: string): string[] {
  const dates: number[] = [];
  let m: RegExpExecArray | null;
  DATE_SIG.lastIndex = 0;
  while ((m = DATE_SIG.exec(entry))) dates.push(m.index);
  if (dates.length < 2) return [entry];

  const cuts: number[] = [0];
  for (let i = 1; i < dates.length; i++) {
    const datePos = dates[i];
    const before = entry.slice(0, datePos).replace(/\s+$/, "");
    const tokens = before.split(/(\s+)/); // keep whitespace to track positions
    let pos = before.length;
    let cut = datePos;
    for (let j = tokens.length - 1; j >= 0; j--) {
      const tk = tokens[j];
      pos -= tk.length;
      if (/^\s+$/.test(tk)) continue;
      if (isUrlish(tk)) break;
      cut = pos; // author-like token; extend the boundary leftward
    }
    cuts.push(cut);
  }

  const segments: string[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const seg = entry.slice(cuts[i], cuts[i + 1] ?? entry.length).trim();
    if (seg) segments.push(seg);
  }
  return segments;
}
