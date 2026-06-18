// Rule-based citation-style formatting checker. Runs entirely in the browser —
// no AI, no network, no credits. Heuristic by design: it catches common
// structural and punctuation problems but cannot judge every edge case
// (e.g. correct italics, which are invisible in pasted plain text).

import { parseReferences } from "./parse-references";

export type CitationStyle = "apa7" | "mla9" | "harvard" | "chicago17";

export type Grade = "green" | "yellow" | "red";

export type ElementType =
  | "journal-article"
  | "conference-paper"
  | "book"
  | "book-chapter"
  | "report"
  | "website"
  | "thesis"
  | "other";

export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  "journal-article": "Journal article",
  "conference-paper": "Conference paper",
  book: "Book",
  "book-chapter": "Book chapter",
  report: "Report",
  website: "Website",
  thesis: "Thesis",
  other: "Other",
};

export interface FormatIssue {
  snippet: string; // substring of the original reference to highlight ("" = none)
  problem: string;
  severity: "minor" | "major";
}

// A run of template text; `italic` parts are rendered in <em> so the generic
// "ideal" template can show style-correct italics (journal names, book titles…).
export interface IdealSegment {
  text: string;
  italic?: boolean;
}

export interface FormatResult {
  n: number;
  reference: string;
  style: CitationStyle;
  grade: Grade;
  elementType: ElementType;
  ideal: IdealSegment[];
  issues: FormatIssue[];
}

export const STYLE_LABELS: Record<CitationStyle, string> = {
  apa7: "APA 7th",
  mla9: "MLA 9th",
  harvard: "Harvard",
  chicago17: "Chicago 17th",
};

const MAX_REFERENCES = 100;

const DOI_RE = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i;
const URL_RE = /https?:\/\/[^\s]+/i;
const YEAR_RE = /\(?\b(\d{4}[a-z]?|n\.d\.)\b\)?/;

interface Parts {
  authors: string; // text before the year, trailing punctuation trimmed
  year: string; // "2024", "n.d." or ""
  yearToken: string; // exact matched text incl. any parentheses, e.g. "(2024)"
  yearInParens: boolean;
  title: string; // best-effort title text
  afterYear: string; // everything after the year token
  doi: string;
  url: string;
  connector: "&" | "and" | "none";
  usesInitials: boolean;
  usesFullNames: boolean;
}

function extractParts(ref: string): Parts {
  const doiM = DOI_RE.exec(ref);
  const urlM = URL_RE.exec(ref);
  const doi = doiM ? doiM[0].replace(/[.,;)]+$/, "") : "";
  const url = urlM ? urlM[0].replace(/[.,;)]+$/, "") : "";

  const ym = YEAR_RE.exec(ref);
  let authors = "";
  let year = "";
  let yearToken = "";
  let yearInParens = false;
  let afterYear = "";
  if (ym) {
    yearToken = ym[0];
    year = ym[1];
    yearInParens = yearToken.startsWith("(") && yearToken.endsWith(")");
    authors = ref.slice(0, ym.index).replace(/[\s.,]+$/, "").trim();
    afterYear = ref.slice(ym.index + yearToken.length).replace(/^[\s.,]+/, "").trim();
  } else {
    authors = "";
    afterYear = ref;
  }

  // Title: first sentence-like chunk of the post-year text (or whole ref).
  let titleSource = afterYear || ref;
  const mu = URL_RE.exec(titleSource);
  if (mu) titleSource = titleSource.slice(0, mu.index).trim();
  titleSource = titleSource.replace(DOI_RE, "").trim();
  const titleM = /^["“']?(.+?)["”']?(?:[.?!](?:\s|$)|$)/.exec(titleSource);
  const title = (titleM ? titleM[1] : titleSource).trim();

  const connector: Parts["connector"] = / & /.test(authors)
    ? "&"
    : /\band\b/i.test(authors)
      ? "and"
      : "none";

  const usesInitials = /,\s*[A-Z]\.(?:\s*[A-Z]\.)*/.test(authors);
  const usesFullNames = /,\s*[A-Z][a-z]{2,}/.test(authors);

  return {
    authors,
    year,
    yearToken,
    yearInParens,
    title,
    afterYear,
    doi,
    url,
    connector,
    usesInitials,
    usesFullNames,
  };
}

// Best-effort element-type classification (like Zotero's item type), based only
// on the reference text. Heuristic and order-sensitive — first match wins.
function detectElementType(ref: string): ElementType {
  const s = ref.toLowerCase();
  const hasDoi = DOI_RE.test(ref);
  const urlM = URL_RE.exec(ref);
  const url = urlM ? urlM[0] : "";
  const isDoiUrl = /doi\.org|arxiv\.org/i.test(url);
  const hasWebUrl = !!url && !isDoiUrl;
  const journalMarkers =
    /\bjournal\b|\bvol\.?\b|\bvolume\b|\bpp\.\b|\bno\.\b|\bissue\b|\(\d{1,4}\)\s*,\s*\d+/.test(
      s,
    );

  if (/\bthesis\b|\bdissertation\b|\bph\.?d\.?\b|master'?s\b|doctoral\b/.test(s))
    return "thesis";
  if (/\bproceedings\b|\bconference\b|\bsymposium\b|\bworkshop\b|\bconf\.\b/.test(s))
    return "conference-paper";
  if (
    /technical report|working paper|white paper|\breport no\.?\b|\bwhitepaper\b|\btech\. rep\.\b/.test(
      s,
    )
  )
    return "report";
  if (/(^|\W)in\s.+\(eds?\.?\)|\(ed\.\)|\beditors?\b|\bchapter\b/.test(s))
    return "book-chapter";
  if (hasDoi || journalMarkers) return "journal-article";
  if (hasWebUrl) return "website";
  if (/\bpress\b|\bpublish|\bbooks?\b|\bedition\b|\bisbn\b/.test(s)) return "book";
  return "other";
}

function gradeFromIssues(issues: FormatIssue[]): Grade {
  if (issues.some((i) => i.severity === "major")) return "red";
  if (issues.length > 0) return "yellow";
  return "green";
}

// Generic, style-correct citation template for a given element type. Instead of
// rebuilding the user's actual reference, this shows the *shape* a correct
// citation should take, using placeholder words (Author name, A.A.; Year;
// Title; Volume; URL; …). `*…*` marks italic runs (journal names, book titles).
//
// Element types where an organization can stand in for a personal author show
// both options ("Author name, A.A. —or— Corporate Author").
const CORPORATE_AUTHOR_TYPES = new Set<ElementType>([
  "website",
  "report",
  "book",
  "book-chapter",
  "journal-article",
  "other",
]);

// Convert a tagged template string (with `*italic*` runs) into segments.
function toSegments(template: string): IdealSegment[] {
  const segments: IdealSegment[] = [];
  const parts = template.split("*");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "") continue;
    segments.push(i % 2 === 1 ? { text: parts[i], italic: true } : { text: parts[i] });
  }
  return segments;
}

// Author placeholder for the given style + element type. APA/Harvard use
// initials ("A.A."); MLA/Chicago use full first names. A corporate-author
// option is appended where that norm applies.
function authorPlaceholder(style: CitationStyle, type: ElementType): string {
  const useInitials = style === "apa7" || style === "harvard";
  const personal = useInitials ? "Author name, A.A." : "Author name, First Middle";
  return CORPORATE_AUTHOR_TYPES.has(type)
    ? `${personal} —or— Corporate Author`
    : personal;
}

const APA_TEMPLATES: Record<ElementType, string> = {
  "journal-article":
    "{A}. (Year). Title of article. *Journal Name*, *Volume*(Issue), pages. https://doi.org/xxxxx",
  "conference-paper":
    "{A}. (Year, Month Day–Day). Title of paper [Paper presentation]. *Conference Name*, Location. URL",
  book: "{A}. (Year). *Title of book* (Edition). Publisher.",
  "book-chapter":
    "{A}. (Year). Title of chapter. In E. E. Editor (Ed.), *Title of book* (Edition, pp. pages). Publisher.",
  report: "{A}. (Year). *Title of report* (Report No. xxx). Publisher. URL",
  website: "{A}. (Year, Month Day). *Title of page*. Site Name. URL",
  thesis:
    "{A}. (Year). *Title of thesis* [Doctoral dissertation, Institution]. Database/Archive. URL",
  other: "{A}. (Year). *Title of work*. Source. URL",
};

const HARVARD_TEMPLATES: Record<ElementType, string> = {
  "journal-article":
    "{A}. (Year) 'Title of article', *Journal Name*, Volume(Issue), pp. pages. Available at: https://doi.org/xxxxx",
  "conference-paper":
    "{A}. (Year) 'Title of paper', *Conference Name*. Location, DD Month YYYY. Available at: URL",
  book: "{A}. (Year) *Title of book*. Edition. Place: Publisher.",
  "book-chapter":
    "{A}. (Year) 'Title of chapter', in E. Editor (ed.) *Title of book*. Place: Publisher, pp. pages.",
  report:
    "{A}. (Year) *Title of report*. Report No. xxx. Place: Publisher. Available at: URL",
  website:
    "{A}. (Year) *Title of page*. Available at: URL (Accessed: DD Month YYYY).",
  thesis: "{A}. (Year) *Title of thesis*. Level. Institution. Available at: URL",
  other: "{A}. (Year) *Title of work*. Available at: URL (Accessed: DD Month YYYY).",
};

const MLA_TEMPLATES: Record<ElementType, string> = {
  "journal-article":
    '{A}. "Title of Article." *Journal Name*, vol. Volume, no. Issue, Year, pp. pages. URL.',
  "conference-paper":
    '{A}. "Title of Paper." *Conference Name*, DD Month YYYY, Location. URL.',
  book: "{A}. *Title of Book*. Edition, Publisher, Year.",
  "book-chapter":
    '{A}. "Title of Chapter." *Title of Book*, edited by First Middle Editor, Publisher, Year, pp. pages.',
  report: "{A}. *Title of Report*. Publisher, Year. URL.",
  website:
    '{A}. "Title of Page." *Site Name*, DD Month YYYY, URL. Accessed DD Month YYYY.',
  thesis:
    "{A}. *Title of Thesis*. Year. Institution, PhD dissertation.",
  other: '{A}. "Title of Work." *Source*, Year, URL.',
};

const CHICAGO_TEMPLATES: Record<ElementType, string> = {
  "journal-article":
    '{A}. "Title of Article." *Journal Name* Volume, no. Issue (Year): pages. https://doi.org/xxxxx.',
  "conference-paper":
    '{A}. "Title of Paper." Paper presented at *Conference Name*, Location, DD Month YYYY.',
  book: "{A}. *Title of Book*. Edition. Place: Publisher, Year.",
  "book-chapter":
    '{A}. "Title of Chapter." In *Title of Book*, edited by First Middle Editor, pages. Place: Publisher, Year.',
  report:
    "{A}. *Title of Report*. Report No. xxx. Place: Publisher, Year. URL.",
  website:
    '{A}. "Title of Page." Site Name. Year. Accessed DD Month YYYY. URL.',
  thesis: '{A}. "Title of Thesis." PhD diss., Institution, Year.',
  other: '{A}. "Title of Work." Source. Year. URL.',
};

const TEMPLATES: Record<CitationStyle, Record<ElementType, string>> = {
  apa7: APA_TEMPLATES,
  harvard: HARVARD_TEMPLATES,
  mla9: MLA_TEMPLATES,
  chicago17: CHICAGO_TEMPLATES,
};

function buildIdealTemplate(style: CitationStyle, type: ElementType): IdealSegment[] {
  const template = TEMPLATES[style][type].replace(
    "{A}",
    authorPlaceholder(style, type),
  );
  return toSegments(template);
}

function commonIssues(p: Parts, ref: string): FormatIssue[] {
  const issues: FormatIssue[] = [];
  if (!p.authors) {
    issues.push({
      snippet: "",
      problem: "No author detected before the year — every entry needs an author (or organization).",
      severity: "major",
    });
  }
  if (!p.year) {
    issues.push({
      snippet: "",
      problem: "No publication year found — add the year (or “n.d.” if there is none).",
      severity: "major",
    });
  }
  if (!p.title) {
    issues.push({
      snippet: "",
      problem: "No title detected — add the title of the work.",
      severity: "major",
    });
  }
  return issues;
}

function checkOne(n: number, ref: string, style: CitationStyle): FormatResult {
  const p = extractParts(ref);
  const issues: FormatIssue[] = commonIssues(p, ref);

  if (style === "apa7" || style === "harvard") {
    if (p.year && !p.yearInParens) {
      issues.push({
        snippet: p.yearToken,
        problem: `${STYLE_LABELS[style]} puts the year in parentheses, e.g. (${p.year}).`,
        severity: "minor",
      });
    }
    if (p.connector === "and") {
      issues.push({
        snippet: " and ",
        problem: `Use “&” instead of “and” before the final author.`,
        severity: "minor",
      });
    }
    if (p.usesFullNames && !p.usesInitials) {
      issues.push({
        snippet: "",
        problem: `Authors should use initials, e.g. “Smith, J.”, not full first names.`,
        severity: "minor",
      });
    }
    if (p.doi) {
      const idx = ref.toLowerCase().indexOf("doi:");
      if (idx !== -1 || !/https?:\/\/doi\.org/i.test(ref)) {
        issues.push({
          snippet: idx !== -1 ? ref.slice(idx, idx + 4) : p.doi,
          problem: `Format the DOI as a full link: https://doi.org/${p.doi}`,
          severity: "minor",
        });
      }
    }
    if (p.afterYear && !/[.)\]]$/.test(ref.trim()) && !p.url && !p.doi) {
      issues.push({
        snippet: "",
        problem: "Reference should end with a period.",
        severity: "minor",
      });
    }
  }

  if (style === "mla9" || style === "chicago17") {
    if (p.yearInParens) {
      issues.push({
        snippet: p.yearToken,
        problem: `${STYLE_LABELS[style]} does not place the year in parentheses in the reference list.`,
        severity: "minor",
      });
    }
    if (p.usesInitials && !p.usesFullNames) {
      issues.push({
        snippet: "",
        problem: `${STYLE_LABELS[style]} uses full first names, e.g. “Smith, John”, not initials.`,
        severity: "minor",
      });
    }
    if (p.connector === "&") {
      issues.push({
        snippet: " & ",
        problem: `Use “and” instead of “&” between authors.`,
        severity: "minor",
      });
    }
    if (p.title && !/["“']/.test(ref)) {
      issues.push({
        snippet: "",
        problem: `Article/chapter titles are placed in quotation marks; container titles are italicized.`,
        severity: "minor",
      });
    }
  }

  const elementType = detectElementType(ref);
  return {
    n,
    reference: ref,
    style,
    grade: gradeFromIssues(issues),
    elementType,
    ideal: buildIdealTemplate(style, elementType),
    issues,
  };
}

export function checkFormatting(text: string, style: CitationStyle): FormatResult[] {
  const refs = parseReferences(text).slice(0, MAX_REFERENCES);
  return refs.map((ref, i) => checkOne(i + 1, ref, style));
}
