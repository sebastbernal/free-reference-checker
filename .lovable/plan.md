**Goal**: Add a clear in-UI privacy statement explaining that uploaded files stay in the browser, are never stored, and only extracted reference text is sent to third-party APIs during checking.

**Location**: `src/routes/index.tsx` — in the main input card, directly under the existing upload-support note (`Supports .txt, .docx and .pdf uploads · up to 100 references.`).

**UI approach**: Insert a small info banner matching the existing muted-info style already used on the page (e.g. the "Not what you expected?" email banner). It will use the `ShieldCheck` or `Info` icon with muted text, placed just before the action buttons so it's visible when users consider uploading.

**Exact text**:
> Your privacy: Uploaded files are processed entirely in your browser — they are never uploaded to or stored on any server. Only the extracted reference text is sent to third-party scholarly APIs (CrossRef, Semantic Scholar, OpenAlex, arXiv, DBLP) and link-checking services during verification.

**Technical details**:
- Add one `<div className="...">` block with an icon + text, using the same styling pattern as the existing muted info banners on the page (flex, gap-3, rounded-lg, border, bg-muted/40, text-sm, text-muted-foreground).
- Import `Info` from `lucide-react` if not already imported. `Info` is already imported (line 10), so no new imports needed.
- No other files touched.