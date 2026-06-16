// Client-only helpers for extracting plain text from uploaded files.
// .txt -> read directly, .docx -> mammoth, .pdf -> pdfjs-dist.
// After extraction we isolate the end "References" section so that body
// text isn't mistakenly parsed as references.

const HEADING_KEYWORDS = [
  "references and notes",
  "reference list",
  "works cited",
  "literature cited",
  "bibliography",
  "references",
  "reference",
  "citations",
];

// Headings that, when they appear AFTER the references heading, mark the end
// of the reference list (trailing matter we want to drop).
const STOP_KEYWORDS = [
  "appendices",
  "appendix",
  "notes",
  "about the author",
  "about the authors",
  "acknowledgements",
  "acknowledgments",
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
  // find the last standalone "References"/"Bibliography" token and slice after it.
  const inlineRe =
    /\b(references and notes|reference list|works cited|literature cited|bibliography|references)\b\s*:?/gi;
  let lastMatchEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = inlineRe.exec(text))) {
    lastMatchEnd = m.index + m[0].length;
  }
  if (lastMatchEnd !== -1) {
    let section = text.slice(lastMatchEnd).trim();
    const stopRe =
      /\b(appendices|appendix|acknowledgements|acknowledgments|about the authors?)\b/i;
    const stop = stopRe.exec(section);
    if (stop) section = section.slice(0, stop.index).trim();
    if (section) return section;
  }

  // 3. No heading found — return everything (file is likely already a list).
  return text.trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return sliceReferencesSection(await file.text());
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return sliceReferencesSection(value);
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => ("str" in it ? it.str : ""));
      text += strings.join(" ") + "\n";
    }
    return sliceReferencesSection(text);
  }

  // Fallback: try to read as text
  return sliceReferencesSection(await file.text());
}
