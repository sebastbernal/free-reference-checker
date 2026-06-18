Replace `src/lib/file-extract.ts` with the provided updated version.

**What changes:**
- Adds `urlKey()` — compares URLs by host+path (ignores query/fragment).
- Adds `spliceHiddenLinks()` — for each annotation URL not already visible in the text, finds the line whose visible URL shares the same host+path, and appends `[link: <url>]` to that line. If no match is found, the link is skipped instead of misattached.
- Updates the PDF branch in `extractTextFromFile` to collect all annotation URLs across pages first, then call `spliceHiddenLinks(text, [...new Set(allLinkUrls)])` once on the combined text — instead of appending hidden links page-by-page at the end of each page.

**Why:** the previous version appended hidden links at the end of every page, so pdfjs's arbitrary annotation order caused them to pile onto whatever reference happened to be last on that page, corrupting those references and breaking their own URL extraction. The new version attaches each hidden link to the correct reference line.

**No signature changes:** `extractTextFromFile`, `sliceReferencesSection`, `pageItemsToText`, `cleanBoilerplate`, `pageAnnotationUrls` remain unchanged in their exports and types.