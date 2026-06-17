// Client-only helpers for extracting plain text from uploaded files.
// .txt -> read directly, .docx -> mammoth, .pdf -> pdfjs-dist.
// After extraction we isolate the end "References" section so that body
// text isn't mistakenly parsed as references.
//
// KEY CHANGE vs the previous version: the PDF branch no longer joins every
// text item with a single space (which destroyed line breaks and turned a whole
// reference list into one run-on line). It reconstructs line breaks from each
// item's vertical position, so the downstream splitter receives one line per
// physical line — the structure it depends on.

// Reference-section headings. The multilingual entries are adapted from the
// CheckIfExist project (D. Abbonato, MIT-licensed) so submissions written in
// other languages are handled too.
const HEADING_KEYWORDS = [
  // English
  "references and notes",
  "reference list",
  "works cited",
  "works referenced",
  "literature cited",
  "cited literature",
  "bibliography",
  "references",
  "reference",
  "citations",
  // Spanish
  "referencias",
  "referencias bibliográficas",
  "bibliografía",
  // Italian
  "riferimenti",
  "riferimenti bibliografici",
  "bibliografia",
  // Portuguese
  "referências",
  "referências bibliográficas",
  // French
  "références",
  "références bibliographiques",
  "bibliographie",
  // German
  "literaturverzeichnis",
  "literatur",
  "quellenverzeichnis",
  "quellen",
];

// Headings that, when they appear AFTER the references heading, mark the end
// of the reference list (trailing matter we want to drop). Multilingual and
// journal-submission sections adapted from CheckIfExist (MIT-licensed).
const STOP_KEYWORDS = [
  // English
  "appendices",
  "appendix",
  "notes",
  "supplementary",
  "supplementary material",
  "supplementary materials",
  "supporting information",
  "acknowledgement",
  "acknowledgements",
  "acknowledgment",
  "acknowledgments",
  "about the author",
  "about the authors",
  "author contributions",
  "author biography",
  "biographies",
  "vita",
  "curriculum vitae",
  "conflict of interest",
  "conflicts of interest",
  "declaration",
  "funding",
  "data availability",
  "ethics statement",
  // Other languages
  "annexe",
  "annexes",
  "anhang",
  "ringraziamenti",
  "agradecimientos",
];

// Strip leading section numbering ("7.", "6.1", "IV.") and a trailing colon,
// then lowercase + collapse whitespace for comparison.
function normalizeHeading(line: string): string {
  return line
    .trim()
    .replace(/^[\divxlcdm]+[.)]\s*/i, "") // 7. / 6) / IV.
    .replace(/^\d+(?:\.\d+)*\s*/, "") // 6.1
    .replace(/[:.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchKeyword(normalized: string, keywords: string[]): boolean {
  return keywords.includes(normalized);
}

/**
 * Return only the references section of a document.
 * Falls back to the full text when no references heading is found.
 */
export function sliceReferencesSection(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  // 1. Line-based detection: find the LAST line that is just a references heading.
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.length > 40) continue; // headings are short
    const norm = normalizeHeading(raw);
    if (matchKeyword(norm, HEADING_KEYWORDS)) headingIdx = i;
  }

  if (headingIdx !== -1) {
    let endIdx = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw || raw.length > 40) continue;
      if (matchKeyword(normalizeHeading(raw), STOP_KEYWORDS)) {
        endIdx = i;
        break;
      }
    }
    const section = lines.slice(headingIdx + 1, endIdx).join("\n").trim();
    if (section) return section;
  }

  // 2. Inline fallback (e.g. PDFs where the heading isn't on its own line):
  // find the last standalone references heading token and slice after it.
  const inlineRe =
    /\b(references and notes|reference list|works cited|works referenced|literature cited|cited literature|bibliography|references|referencias bibliográficas|referencias|bibliografía|riferimenti bibliografici|riferimenti|bibliografia|referências bibliográficas|referências|références bibliographiques|références|bibliographie|literaturverzeichnis|quellenverzeichnis)\b\s*:?/gi;
  let lastMatchEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(text))) {
    lastMatchEnd = m.index + m[0].length;
  }
  if (lastMatchEnd !== -1) {
    let section = text.slice(lastMatchEnd).trim();
    const stopRe =
      /\b(appendices|appendix|supplementary materials?|supporting information|acknowledgements?|acknowledgments?|about the authors?|author contributions|conflicts? of interest|funding|data availability|ethics statement|ringraziamenti|agradecimientos)\b/i;
    const stop = stopRe.exec(section);
    if (stop) section = section.slice(0, stop.index).trim();
    if (section) return section;
  }

  // 3. No heading found — return everything (file is likely already a list).
  return text.trim();
}

// Reconstruct page text from pdfjs text items, inserting "\n" at line breaks.
// pdfjs gives each item a transform matrix [a,b,c,d,e,f] where f is the Y
// position (PDF user space, larger Y = higher on the page). A drop in Y means a
// new line. Newer pdfjs builds also set `hasEOL` on items, which we honour.
function pageItemsToText(items: any[]): string {
  let out = "";
  let lastY: number | null = null;
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue;
    const tr = it.transform || it.transformMatrix;
    const y = Array.isArray(tr) ? tr[5] : null;
    if (lastY !== null && y !== null) {
      // Tolerance absorbs sub-pixel font jitter within a line.
      if (Math.abs(y - lastY) > 2) {
        // strip a trailing space before the newline
        out = out.replace(/[ \t]+$/, "");
        if (!out.endsWith("\n")) out += "\n";
      } else if (out && !/\s$/.test(out) && !/^\s/.test(it.str)) {
        // same line, adjacent items — ensure a separating space
        out += " ";
      }
    }
    out += it.str;
    if (y !== null) lastY = y;
    if (it.hasEOL) {
      out = out.replace(/[ \t]+$/, "");
      if (!out.endsWith("\n")) out += "\n";
      lastY = null;
    }
  }
  return out;
}

// Remove common PDF/journal boilerplate that interleaves with references:
// running headers/footers, copyright lines, "Downloaded from ...". Operates
// line-by-line so it can't accidentally chew into a reference. Standalone page
// numbers are also removed (the splitter handles in-line ones, but clearing
// them here keeps section detection clean). Adapted from CheckIfExist (MIT).
function cleanBoilerplate(text: string): string {
  return text
    .replace(/^\s*\d{1,4}\s*$/gm, "") // standalone page numbers
    .replace(
      /^\s*(downloaded from|copyright ©|copyright \(c\)|all rights reserved|published by|this content downloaded)\b.*$/gim,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return sliceReferencesSection(cleanBoilerplate(await file.text()));
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return sliceReferencesSection(cleanBoilerplate(value));
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
      .default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    // References live at the end, so for long documents only read the final
    // pages — faster, and avoids pulling body text that confuses detection.
    const LAST_N_PAGES = 60;
    const startPage = Math.max(1, pdf.numPages - LAST_N_PAGES + 1);
    let text = "";
    for (let p = startPage; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Reconstruct line breaks from item positions instead of join(" ").
      text += pageItemsToText(content.items) + "\n";
    }
    return sliceReferencesSection(cleanBoilerplate(text));
  }

  // Fallback: try to read as text
  return sliceReferencesSection(cleanBoilerplate(await file.text()));
}
