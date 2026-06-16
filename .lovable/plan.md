## Persist results across reloads + add an "About" section

### Problem 1 — results lost on reload
Right now the input text, results, and filter live only in React `useState`, so any reload (the preview's hot-reload, an accidental refresh, or navigating back) wipes everything and the user has to re-run the whole check.

**Fix:** persist state to `sessionStorage` so it survives reloads within the tab.
- In `src/routes/index.tsx`, initialize `text`, `results`, and `filter` from `sessionStorage` on first render (with safe JSON parsing and a `typeof window` guard for SSR).
- Write `text`, `results`, and `filter` back to `sessionStorage` via `useEffect` whenever they change.
- Add a small "Clear" button next to the results summary to wipe stored state and start fresh.

This keeps results visible after a reload without needing a database.

### Problem 2 — explain what happens in the background
Add an **About / How it works** section so users understand the verification pipeline.

- Add a collapsible/info card below the results (and visible before any check, under the input card) titled "How it works".
- Content, in plain language:
  - References are parsed from pasted text or an uploaded file (.txt/.docx/.pdf). For uploads, only the "References"/"Bibliography" section at the end of the document is used.
  - Each reference is auto-classified as **Academic**, **Web**, or **Offline**.
  - **Academic**: looked up by DOI first (CrossRef, OpenAlex), then by title across CrossRef, OpenAlex, Semantic Scholar, arXiv and DBLP. A title-similarity score decides Real vs. Check vs. likely-fabricated.
  - **Web**: the link is fetched to check it is live (HTTP status); dead links are looked up in the Internet Archive (Wayback) — archived, no-trace, or inconclusive.
  - **Offline** (e.g. books): flagged as not auto-verifiable.
  - Note that results are heuristic and flagged items should be checked manually.
- Use a shadcn `Accordion` (already available) for a clean expandable layout, with the verdict legend (Real / Check / No trace / Archived / Offline / Inconclusive) explained.

### Files
- `src/routes/index.tsx` — sessionStorage persistence, Clear button, render the About/How-it-works accordion.
- (No backend or logic changes; verification pipeline stays the same.)