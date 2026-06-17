Update the homepage header and meta tags to reflect both authenticity-checking and format-checking capabilities.

Changes in `src/routes/index.tsx`:
1. **H1 title** (line 411): Change from `Detect likely-fabricated references` to `Check reference authenticity and citation format`.
2. **Subtitle paragraph** (lines 413-418): Rewrite to mention both features — e.g. "Paste a reference list or upload a file. Verify citations against CrossRef, Semantic Scholar, OpenAlex, arXiv and DBLP; check web links for liveness; and validate citation formatting against APA, MLA, Chicago, Harvard, IEEE and Vancouver styles."
3. **Route head() meta** (lines 59-73): Update `title`, `description`, `og:title`, and `og:description` to mention both authenticity and format checking so social/link previews match the updated messaging.