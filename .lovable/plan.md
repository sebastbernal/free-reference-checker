## Goal

When a document is uploaded (.txt / .docx / .pdf), only feed the **References section** into the checker — not the whole body text. References sit at the end of a document under a heading like "References", "Bibliography", or "Works Cited". Right now the full document text is dumped into the textarea, so body paragraphs get mistakenly parsed as references.

## Change (frontend extraction only)

Add a `sliceReferencesSection(text)` helper in `src/lib/file-extract.ts` and apply it inside `extractTextFromFile` right before returning, for all three file types. Paste input is left untouched (the user pastes references directly).

### Detection logic

1. Scan the extracted text line by line.
2. A line is a **references heading** when its trimmed text — after stripping leading section numbering (e.g. `7.`, `6.1`, `IV.`) and a trailing colon — case-insensitively equals one of:
   - `References`, `Reference`, `Reference List`
   - `Bibliography`
   - `Works Cited`, `Literature Cited`
   - `References and Notes`
   - `Citations`
   The whole line must be short (just the keyword, not a sentence) so in-text mentions like "see the references in…" are ignored.
3. Use the **last** matching heading in the document (references appear near the end; this avoids a table-of-contents entry near the top).
4. Take everything **after** that heading line to the end of the document.
5. If a later heading such as `Appendix`, `Appendices`, `Notes`, or `About the author(s)` appears after the references heading, cut the slice off there (so trailing non-reference matter is dropped).
6. **Fallback:** if no references heading is found, return the full extracted text unchanged (current behaviour), so nothing breaks for files that are already just a reference list.

### PDF note

PDF extraction currently joins each page's items with spaces and pages with `\n`, so headings may not sit on their own line. The slice will run on the same text; the line-based heading test still works for `.txt`/`.docx`. For PDFs the helper will additionally match the keyword as a standalone token boundary within the text (last occurrence) when no line-based match exists, then slice from there.

## Out of scope

- No change to `reference-check.functions.ts` parsing, the source lookups, or the UI.
- Not attempting to extract references from inside body text / footnotes — only the dedicated end section, as requested.

## Verification

Test the helper against sample inputs: (a) a doc with body text + "References" heading + list, (b) "BIBLIOGRAPHY" uppercase, (c) "7. References" numbered, (d) references followed by an "Appendix", (e) a plain reference list with no heading (fallback returns all). Confirm only the reference entries remain in each case.
