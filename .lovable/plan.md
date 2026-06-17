# Add a Citation Style / Formatting Checker (rule-based, free)

Split the app into two sections via tabs:

1. **Verify** — the existing authenticity & fabrication checker (unchanged).
2. **Format** — a new citation-style checker. The user picks a style (APA 7th, MLA 9th, Harvard, or Chicago 17th), pastes references, and gets back, per reference: an "ideal" version, the pasted version with problem parts highlighted, a list of what's missing/wrong/different, and an overall green / yellow / red grade.

No AI, no credits, no network calls — the format check runs entirely in the browser with rule-based heuristics, consistent with the tool's privacy posture.

## How the format checker works

Pure rule-based parsing + checks (no AI). For each reference we extract the parts (authors, year, title, source/journal/publisher, DOI/URL) using regex/heuristics, then validate them against the rules of the selected style and rebuild a best-effort "ideal" version.

Checks per style include: presence/position of the year, parentheses around the year, author format (initials, `&` vs `and` vs `,`), title casing, italics conventions (flagged textually since we can't see the source formatting), terminal punctuation, ampersand usage, DOI as a full `https://doi.org/...` URL, and ordering of elements.

Grades:
- **Green — Perfect:** all required parts present and well-formed; no/cosmetic issues.
- **Yellow — Needs improvement:** minor problems (punctuation, spacing, `&` vs "and", element order, missing DOI URL formatting).
- **Red — Very bad:** major problems (missing author, year, or title; wrong overall structure).

Grade is derived from issue severities: any `major` → red; only `minor` → yellow; none → green.

## UI

```text
+------------------------------------------------------+
|  [ Verify ]  [ Format ]            <- tabs           |
+------------------------------------------------------+
|  Style:  ( APA 7th ) ( MLA 9th ) ( Harvard ) ( Chicago 17th )
|  [ paste references textarea ]      [Try example][Upload]
|                                     [ Check formatting ]
+------------------------------------------------------+
|  Summary: 3 perfect · 2 need work · 1 bad            |
|                                                      |
|  #1  [GREEN Perfect]   APA 7th                       |
|     Your reference:  ...with wrong parts highlighted |
|     Ideal:           Smith, J. (2024). Title. ...    |
|     Issues: (none)                                   |
|                                                      |
|  #2  [YELLOW Needs improvement]                      |
|     Your reference:  ...<mark>(2024)</mark>...       |
|     Ideal:           ...                             |
|     Issues:                                          |
|       • Missing parentheses around the year          |
|       • Use "&" not "and" before the last author     |
+------------------------------------------------------+
```

- Tabs use the existing `src/components/ui/tabs.tsx`.
- Highlighting: the pasted reference is rendered with offending substrings wrapped in a colored `<mark>` (amber for "needs improvement", red for "wrong/missing"). Each issue carries the snippet text, located in the original reference to build the highlighted output.
- Each result is a card with a colored left bar / badge (green/yellow/red), mirroring the existing `ReferenceResultCard` look.
- The "support this tool", "How it works", and footer sections stay shared below both tabs.

## Technical details

**New module — `src/lib/format-check.ts`** (plain client-side, no server function)
- Exports `checkFormatting(text: string, style: CitationStyle): FormatResult[]`.
- Reuses the same line-splitting logic the verifier uses (`parseReferences`) to split pasted text into individual references; caps at 100.
- For each reference: extract parts, run the style's rule set, produce `{ n, reference, style, grade: "green"|"yellow"|"red", ideal: string, issues: { snippet: string, problem: string, severity: "minor"|"major" }[] }`.
- Rules live in a per-style config object so APA/MLA/Harvard/Chicago each describe their author/year/title/source expectations; shared helpers handle extraction and the ideal-string rebuild.
- `parseReferences` is currently private in `src/lib/reference-check.functions.ts`; extract it into a shared client-safe helper (e.g. `src/lib/parse-references.ts`) and import it from both the verifier server function and the new format module.

**New component — `src/components/FormatResultCard.tsx`**: renders the grade badge + colored bar, the highlighted "your reference", the ideal reference, and the issue list. A small helper builds the highlighted JSX by splitting the original text on the issue snippets.

**`src/routes/index.tsx`**
- Wrap the input + results area in `<Tabs>` with `Verify` and `Format` triggers (default `Verify`).
- Move the current textarea/upload/results block into the `Verify` tab (logic unchanged).
- Add the `Format` tab: style selector (button group), shared textarea/upload, a "Check formatting" button that runs `checkFormatting` synchronously, a summary line, and a list of `FormatResultCard`s.
- Add a style-appropriate example string for the format tab.
- Persist the format tab's text/style/results in the existing sessionStorage state object.

**Dependencies:** none added (no AI packages).

**Verification:** run a format check on the example with APA selected and confirm grades, highlighting, ideal reference, and the issue list render with the correct green/yellow/red colors; switch styles and confirm the rules change; confirm the existing Verify tab still works unchanged.

## Notes
- Rule-based formatting checks are heuristic: they catch common structural and punctuation problems well, but can't perfectly judge every edge case (e.g. correct italics, which aren't visible in pasted plain text). The UI will note this, the same way the verifier notes its results are heuristic.
- Fully free: no credits, no backend, nothing sent off the device.
