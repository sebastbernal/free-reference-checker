// Reference list parser. Turns a raw paste (from Word, PDF, or Canvas) into an
// array of individual reference strings.
//
// Design: two separate phases that never feed each other's heuristics.
//   1. SEGMENT  — group physical lines into one logical block per reference.
//   2. REPAIR   — within each block, rejoin soft-wrapped URLs and tidy spacing.
//
// Phase 1 relies on ONE signal: a line that "starts a new reference" closes the
// current block, but only when the current block already "looks complete". This
// avoids the run-on date-counting machinery that mis-cut multi-date entries.

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Strip zero-width and other invisible characters that Canvas/Word inject
// (zero-width space/non-joiner/joiner, BOM, soft hyphen).
function stripInvisibles(s: string): string {
  return s.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "");
}

// Canvas turns bare URLs into markdown links: "[Www.ipcc.ch](https://Www.ipcc.ch)".
// Replace "[label](url)" with just the label so the visible text is preserved
// and the duplicated URL inside the parens is dropped.
function stripMarkdownLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]*\)/gi, "$1");
}

// A line that is nothing but a page number (e.g. a stray "6" from a PDF footer).
function isPageNumberLine(s: string): boolean {
  return /^\d{1,4}$/.test(s.trim());
}

// ---------------------------------------------------------------------------
// Phase 1 helpers: boundary detection
// ---------------------------------------------------------------------------

const DATE_TOKEN = String.raw`\((?:\d{4}(?!\d)[a-z]?|n\.d\.)(?:,[^)]{0,40})?\)`;

// Does this line look like the genuine start of a new reference?
function looksLikeStart(line: string, buffer = ""): boolean {
  const s = line.trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower.startsWith("http") || lower.startsWith("www.")) return false;
  if (/^doi\b/i.test(s) || lower.startsWith("doi:")) return false;
  if (/^(retrieved|available|in\b|at:)/i.test(s)) return false;

  // (a) numbered list markers
  if (/^(\[\d+\]|\(\d+\)|\d+[.)])\s+/.test(s)) return true;

  // A continuation of a wrapped AUTHOR LIST, not a new reference. Wrapped
  // author lists begin with a connective ("& ", "and ") or a bare initial
  // ("Y., & Kuan...", "Lovelock, C. E., ..."). Crucially, the current buffer
  // has NOT reached its date yet — a real new entry only follows a buffer that
  // already carries its own (year). So: if no date in the buffer and this line
  // opens like an author-list tail, treat it as continuation.
  const bufHasDate = new RegExp(DATE_TOKEN).test(buffer);
  if (!bufHasDate) {
    if (/^(&|and)\s+[A-Z]/.test(s)) return false; // "& Kuan, W. S. ..."
    if (/^[A-Z]\.(,|\s)/.test(s)) return false; // "Y., & Kuan" / "E. Author"
  }

  // (b) author surname followed by an initial: "Surname, X." or "Surname, X.Y."
  if (/^[A-ZÀ-Þ][\wÀ-ÿ'’.-]*,\s*[A-Z]\.?/.test(s)) return true;

  // (c) a capitalised name/org/initialism with an early parenthetical date.
  const earlyDate = new RegExp(String.raw`^[A-ZÀ-Þ].{0,90}?${DATE_TOKEN}`);
  if (earlyDate.test(s)) return true;

  return false;
}

// Does the accumulated block look finished — i.e. is it safe to treat the next
// start-looking line as a new reference rather than a continuation?
// Complete when it ends in terminal punctuation, ends in a URL, or already
// contains a date token (a reference with its date is substantial enough that a
// following author line is overwhelmingly a new entry).
function looksComplete(block: string): boolean {
  const b = block.trim();
  if (!b) return false;
  if (/[.)\]\/]$/.test(b)) return true; // ends on terminal punctuation
  // Ends inside/at a URL, even if the URL was soft-wrapped (a space sits inside
  // it). True when the block contains a scheme and the final token looks like a
  // URL fragment (no spaces, has url-ish characters) rather than prose.
  if (/https?:\/\//.test(b)) {
    const lastTok = b.split(/\s+/).pop() ?? "";
    if (/[\/.\-_%?#=&~]/.test(lastTok) && !/\s/.test(lastTok)) return true;
  }
  if (new RegExp(DATE_TOKEN).test(b)) return true; // has its date already
  return false;
}

// ---------------------------------------------------------------------------
// Phase 1: segment lines into per-reference blocks
// ---------------------------------------------------------------------------

// A line wrap can fall INSIDE a parenthetical date, e.g. a line ending in
// "(20" or "(2019," with the rest ("19, November 5).") on the next line. That
// hides the date token from start-detection. Pre-join such fragments so dates
// are whole before we segment. Only triggers on an unmistakable dangling
// open-paren-year fragment, so it can't merge unrelated lines.
function repairWrappedDates(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    // "...Occupations. (20" or "...Occupations. (2019, November" -> needs the
    // continuation on the next line. Trigger when the line has an unclosed
    // parenthesis whose content starts with a year-like or n.d. token.
    while (
      i + 1 < lines.length &&
      /\((?:\d{1,4}|n\.d)[^)]*$/.test(ln.trim()) // open paren + year/n.d., no close
    ) {
      ln = ln.replace(/\s+$/, "") + " " + lines[i + 1].trim();
      i++;
    }
    out.push(ln);
  }
  return out;
}

function segment(raw: string): string[] {
  const text = stripMarkdownLinks(stripInvisibles(raw.replace(/\r\n?/g, "\n")));
  const rawLines = repairWrappedDates(text.split("\n"));

  // Decide structure: if blank lines separate references, trust them as hard
  // boundaries; otherwise fall back to start/complete detection. We detect this
  // per-gap rather than globally, so a file that mixes both still works.
  const lines = rawLines.map((l) => l.replace(/\s+$/g, ""));

  const blocks: string[] = [];
  let current = "";
  let sawBlankSinceContent = false;

  const flush = () => {
    const t = current.trim();
    if (t) blocks.push(t);
    current = "";
  };

  for (const rawLn of lines) {
    const ln = rawLn.trim();
    if (!ln) {
      sawBlankSinceContent = true;
      continue;
    }
    if (isPageNumberLine(ln)) {
      // drop stray page numbers entirely
      sawBlankSinceContent = false;
      continue;
    }
    if (!current) {
      current = ln;
      sawBlankSinceContent = false;
      continue;
    }

    // A blank line immediately before a start-looking line is a hard boundary.
    const blankBoundary = sawBlankSinceContent && looksLikeStart(ln, current);
    // Otherwise use the soft signal: new start + complete buffer.
    const softBoundary =
      !sawBlankSinceContent &&
      looksLikeStart(ln, current) &&
      looksComplete(current);

    if (blankBoundary || softBoundary) {
      flush();
      current = ln;
    } else {
      // continuation — join. A blank line that did NOT precede a start gets
      // absorbed (some Canvas pastes blank-separate within one reference).
      current += " " + ln;
    }
    sawBlankSinceContent = false;
  }
  flush();
  return blocks;
}

// Some PDFs drop the newline between two references entirely, fusing the end of
// one URL directly onto the next author: ".../sh16Global Green ... (n.d.)."
// Detect a fusion point: a URL character run that ends in lowercase/digit
// immediately followed by an uppercase letter, where a date token appears soon
// after (marking the fused reference's own date). Split at the capital.
// Conservative: only fires when a (date) token follows within ~120 chars and the
// pre-capital tail is part of a URL (contains "/" since the last space).
function splitFusedAfterUrl(block: string): string[] {
  const re = /([a-z0-9])([A-ZÀ-Þ][a-zà-ÿ])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const cut = m.index + 1; // position of the uppercase letter
    const before = block.slice(0, cut);
    const after = block.slice(cut);
    // The boundary must sit inside a URL token (no space since last whitespace,
    // and that token contains "/"). And the following text must reach its own
    // date token quickly, confirming it's a real new reference.
    const lastSpace = before.lastIndexOf(" ");
    const tail = before.slice(lastSpace + 1);
    const followsUrl = tail.includes("/");
    const afterHasEarlyDate = new RegExp(
      String.raw`^.{0,120}?${DATE_TOKEN}`,
    ).test(after);
    if (followsUrl && afterHasEarlyDate && looksLikeStart(after)) {
      // recurse in case more than two are fused
      return [before.trim(), ...splitFusedAfterUrl(after.trim())];
    }
  }
  return [block];
}

// Within a URL, a soft wrap shows up as whitespace. Rejoin URL fragments.
// Rules, applied only when the left side is a URL and the right side is a URL
// continuation (starts lowercase/digit/%/slug punctuation, OR is a slug-like
// token containing "-" or "/"):
//   - if the URL already ends with "-", glue directly (hyphen was kept at wrap)
//   - else glue directly with no separator (PDF wrap that dropped the hyphen,
//     e.g. "genetic-" + "modification" was already handled; bare "Choosing" too)
// A capitalised plain word with no slug punctuation is treated as trailing prose
// (next reference / source name) and left alone.
function rejoinWrappedUrl(block: string): string {
  // Walk left-to-right, repeatedly merging "url <space> fragment" while the
  // fragment qualifies as URL continuation.
  let out = block;
  let changed = true;
  while (changed) {
    changed = false;
    const m = out.match(/(https?:\/\/[^\s]+)(\s+)(\S+)/);
    if (!m) break;
    const [whole, url, , rest] = m;
    const idx = out.indexOf(whole);

    // Is `rest` a URL continuation or prose?
    const isContinuation =
      // slug-like: contains - or / or % or query punctuation
      /[-\/%?#=&._~]/.test(rest.split(/\s/)[0]) ||
      // or starts lowercase / digit (mid-word or path piece)
      /^[a-z0-9%]/.test(rest);
    if (!isContinuation) break; // prose follows the URL; stop merging here

    // Take only the first whitespace-delimited token of `rest` as the fragment;
    // anything after stays as separate text.
    const frag = rest;
    const glue = url.endsWith("-") ? "" : "";
    const merged = url + glue + frag;
    out = out.slice(0, idx) + merged + out.slice(idx + whole.length);
    changed = true;
  }
  return out;
}

function repair(block: string): string {
  let b = block.replace(/\s+/g, " ").trim();
  b = rejoinWrappedUrl(b);
  // Collapse any space that slipped inside a URL before a fragment-merge missed
  // it because the next token was uppercase but clearly still URL (handled
  // conservatively: only join when there's no space-then-space).
  return b.trim();
}

// ---------------------------------------------------------------------------
// Run-on fallback: a single block that never got line breaks (e.g. a PDF
// extractor that joined everything with spaces) but clearly contains several
// references. Only fires when a block is long AND has 2+ date signatures, so it
// never touches normal well-segmented input.
// ---------------------------------------------------------------------------

function splitRunOnBlock(block: string): string[] {
  const dateRe = new RegExp(DATE_TOKEN, "g");
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = dateRe.exec(block))) positions.push(m.index);

  // Not a run-on: 0 or 1 reference's worth of dates, or a short block.
  if (positions.length < 2 || block.length < 400) return [block];

  // Cut just before the author/org that precedes each date after the first.
  // Walk left from each date past its author tokens until we hit something that
  // belongs to the previous reference (a URL-ish token or terminal punctuation).
  const cuts: number[] = [0];
  for (let i = 1; i < positions.length; i++) {
    const datePos = positions[i];
    const before = block.slice(0, datePos).replace(/\s+$/, "");
    const tokens = before.split(/(\s+)/);
    let pos = before.length;
    let cut = datePos;
    for (let j = tokens.length - 1; j >= 0; j--) {
      const tk = tokens[j];
      pos -= tk.length;
      if (/^\s+$/.test(tk)) continue;
      // Stop at tokens that belong to the previous reference.
      if (/:\/\/|\/|www\.|\.(?:com|org|net|edu|gov|au|uk|io|pdf|html?)\b/i.test(tk))
        break;
      if (/^[a-z]/.test(tk) && !/^(and|von|van|de|del|della|di|la|le)$/i.test(tk))
        break;
      if (/[.)\]]$/.test(tk) && pos < cut - 3) {
        // a clean sentence end just before the author block — cut after it
        cut = pos + tk.length;
        break;
      }
      cut = pos; // author-like; extend boundary left
    }
    if (cut > (cuts[cuts.length - 1] ?? 0)) cuts.push(cut);
  }

  const out: string[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const seg = block.slice(cuts[i], cuts[i + 1] ?? block.length).trim();
    if (seg) out.push(seg);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseReferences(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return segment(raw)
    .flatMap(splitRunOnBlock) // revive run-on blocks that lost their newlines
    .flatMap(splitFusedAfterUrl)
    .map(repair)
    .filter((s) => s.length > 0);
}
