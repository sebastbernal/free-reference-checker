### Scope
Replace the entire contents of `src/lib/file-extract.ts` with the exact code provided by the user.

### What changes
1. Add a new `pageAnnotationUrls(page)` async helper that reads a PDF page's link annotations (`page.getAnnotations()`), extracts `url` / `unsafeUrl` fields, filters to `http(s)` URLs, deduplicates, and returns them.

2. In the PDF branch of `extractTextFromFile`, after reconstructing visible page text with `pageItemsToText`, also call `pageAnnotationUrls(page)`. Any URL present in the annotations but NOT already in the visible text is surfaced as `[link: <url>]` on its own line. These hidden URLs are where AI tracking parameters (e.g. `?utm_source=chatgpt.com`) live in PDFs — the visible citation looks clean but the hyperlink target carries the trace.

3. No signature changes — `extractTextFromFile` and `sliceReferencesSection` keep the same exports and types. TXT and DOCX branches untouched.

### Why
Downstream AI-trace detection scans reference strings for parameters like `utm_source=chatgpt.com`. When a PDF's visible text shows a clean URL but the actual hyperlink target hides the tracking parameter in an annotation, the scanner misses it. By surfacing those hidden targets as `[link: <url>]` markers inside the extracted text, the scanner still sees the parameter.

### Testing
- Build passes (`bun run build`).
- Upload a PDF with hyperlinked references where the annotation URL differs from the visible text; verify the `[link: ...]` markers appear in the extracted text shown in the UI or console.

### Files changed
- `src/lib/file-extract.ts` — full replacement (same exports, no signature changes).