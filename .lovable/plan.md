# Fix the preview crash

The preview is crashing for two independent reasons, both visible in the logs.

## Problem 1 — `result.ideal.map is not a function` (the hard crash)

The page saves the whole formatting state — including `formatResults` — into `sessionStorage` and restores it on load (`src/routes/index.tsx`). Older sessions were saved when `result.ideal` was a plain **string**. After the recent change, `ideal` is an **array of segments** and `FormatResultCard` calls `result.ideal.map(...)`. When the app restores the old saved data, `ideal` is still a string, `.map` doesn't exist, and the component throws — taking down the whole page via the error boundary.

**Fix:** add a schema version to the persisted state so incompatible old data is discarded instead of restored.

- In `src/routes/index.tsx`, add a `STORAGE_VERSION` constant.
- When **writing** to `sessionStorage`, include `version: STORAGE_VERSION` in the saved object.
- When **reading**, if `saved.version !== STORAGE_VERSION`, ignore the stored data entirely (and clear the key). This prevents this class of crash now and on any future shape change.

## Problem 2 — Hydration mismatch on the footer date

`BUILD_DATE = new Date().toLocaleDateString(...)` is computed at module load. The server and the browser evaluate it at slightly different moments / timezones, so around midnight the server renders `Jun 18, 2026` while the client renders `Jun 19, 2026`. React reports a hydration mismatch (`server rendered text didn't match the client`) and regenerates the tree, which destabilizes the page.

**Fix:** stop rendering a runtime date during SSR.

- Render the "Updated {date}" portion only after mount (e.g. hold the formatted date in state set inside a `useEffect`, showing nothing/`v{VERSION}` until then), so the server and first client render agree.

## Out of scope

No change to the citation templates, parsing, classification, or issue detection — only the persistence/versioning and the footer date rendering.

## Technical notes

- Files touched: `src/routes/index.tsx` only.
- After the fix, also clears any already-corrupt `sessionStorage` from the current browser via the version check, so the user's existing broken session recovers on next load.
