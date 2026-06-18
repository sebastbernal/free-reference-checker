## Goal

In the **Check formatting** section, replace the per-reference "Ideal format" box (which currently rebuilds your actual reference text) with a **generic, properly typeset citation template** for the detected element type and selected style — using placeholder words *(Author name, A.A.; Corporate Author; Year; Title; Volume; Issue; URL; DD/MM/YYYY date accessed; Edition)* and rendering correct **italics, spacing, and punctuation** per style.

### Author placeholder

The author slot shows **both options** wherever a style/type allows a corporate (organization) author as well as a personal author:
```text
Author name, A.A.  —or—  Corporate Author
```
Clarification note below the box:
> **A.A.** = the author's initials (e.g. *Smith, J.A.*). For MLA/Chicago (full first names) it reads *Author name, First Middle*.
> **Corporate Author** = an organization/company as author (e.g. *World Health Organization*), used when no individual is credited.

Where the norm does not apply (e.g. thesis), only `Author name, A.A.` is shown.

### Typography (italics / spacing / punctuation)

Templates render the parts that each style italicizes — e.g. APA italicizes *Journal Name, Volume* and book/report *titles*; MLA italicizes *container titles*; article/chapter titles go in "quotation marks". Spacing and punctuation follow each style (parenthetical year for APA/Harvard, period vs comma separators, etc.). Example (APA 7th journal article, *italic* = rendered italic):

```text
Author name, A.A. —or— Corporate Author. (Year). Title of article. *Journal Name*, *Volume*(Issue), pages. https://doi.org/xxxx
```

## What changes

1. **`src/lib/format-check.ts`**
   - Change the ideal representation so italics can be rendered: `FormatResult.ideal` becomes an array of segments `{ text: string; italic?: boolean }` (or a tagged string the card parses). This keeps style-correct italics out of plain text.
   - Add a template map keyed by `(CitationStyle, ElementType)` returning these generic placeholder segments for every combination (4 styles × 8 element types), with correct italics, spacing, and punctuation.
   - Corporate-author types (website, report, book, book-chapter, journal-article, other) show `Author name, A.A. —or— Corporate Author`; personally-authored types (thesis, conference-paper) show only `Author name, A.A.`.
   - Replace the `buildIdeal(p, style)` call in `checkOne` with a lookup into this map by `elementType` + `style`.
   - Issue-detection logic (still using the real parsed reference) is untouched — only the displayed "ideal" becomes generic.

2. **`src/components/FormatResultCard.tsx`**
   - Render the new segmented `ideal` value, wrapping italic segments in `<em>` so italics/spacing display correctly.
   - Relabel the box to **"How a {element type} should be cited — {style}"**.
   - Add the small clarification lines for **A.A.** and **Corporate Author** beneath the box.

## Out of scope

- No backend/AI changes, no change to reference parsing, classification heuristics, or issue detection.
- The "Your reference" highlighting and issues list stay exactly as they are.