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

export interface FormatResult {
  n: number;
  reference: string;
  style: CitationStyle;
  grade: Grade;
  elementType: ElementType;
  ideal: string;
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

function gradeFromIssues(issues: FormatIssue[]): Grade {
  if (issues.some((i) => i.severity === "major")) return "red";
  if (issues.length > 0) return "yellow";
  return "green";
}

// Best-effort "ideal" reconstruction. Approximate — communicates the target
// structure rather than guaranteeing a byte-perfect citation.
function buildIdeal(p: Parts, style: CitationStyle): string {
  const authors = p.authors || "Author, A. A.";
  const year = p.year || "Year";
  const title = p.title || "Title of the work";
  const doiUrl = p.doi
    ? `https://doi.org/${p.doi}`
    : p.url || "";

  // Normalize the author string to end with a single period (names and
  // initials should terminate with one), then let each style add its own
  // separators — avoids "Doe, A" and "A.." artifacts.
  const withConnector = (preferred: "&" | "and") => {
    const base =
      p.connector === "none"
        ? authors
        : authors.replace(
            preferred === "&" ? /\s+and\s+/i : /\s+&\s+/,
            ` ${preferred} `,
          );
    return base.replace(/[\s.,]+$/, "") + ".";
  };

  switch (style) {
    case "apa7": {
      const a = withConnector("&");
      return `${a} (${year}). ${title}.${doiUrl ? ` ${doiUrl}` : ""}`.trim();
    }
    case "harvard": {
      const a = withConnector("&");
      return `${a} (${year}) ${title}.${doiUrl ? ` Available at: ${doiUrl}` : ""}`.trim();
    }
    case "mla9": {
      const a = withConnector("and");
      return `${a} "${title}." ${year}${doiUrl ? `, ${doiUrl}` : ""}.`.trim();
    }
    case "chicago17": {
      const a = withConnector("and");
      return `${a} ${year}. "${title}."${doiUrl ? ` ${doiUrl}.` : ""}`.trim();
    }
  }
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

  return {
    n,
    reference: ref,
    style,
    grade: gradeFromIssues(issues),
    ideal: buildIdeal(p, style),
    issues,
  };
}

export function checkFormatting(text: string, style: CitationStyle): FormatResult[] {
  const refs = parseReferences(text).slice(0, MAX_REFERENCES);
  return refs.map((ref, i) => checkOne(i + 1, ref, style));
}
