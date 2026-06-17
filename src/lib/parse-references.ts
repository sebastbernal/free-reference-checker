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

  return entries.map((e) =>
    e
      .replace(/(https?:\/\/\S+)\s+([a-z0-9%][^\s]*)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
