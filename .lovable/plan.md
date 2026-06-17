## Problem
Clicking **Check formatting** does run (`handleCheckFormat` computes results and calls `setFormatResults`), but the results render in a section far below the input card — below the authenticity results too. On a short viewport nothing visibly changes, so it feels like "click does nothing."

## Fix
Make the action visibly respond by auto-scrolling to the freshly rendered results, and give a small in-view confirmation.

### Changes in `src/routes/index.tsx`
1. **Add result section refs** — a `formatResultsRef` and a `verifyResultsRef` (`useRef<HTMLDivElement>`), attached to the existing format-results `<div>` and the verify-results `<div>`.
2. **Scroll on action:**
   - In `handleCheckFormat`, after `setFormatResults(out)` and when `out.length > 0`, scroll `formatResultsRef` into view (`scrollIntoView({ behavior: "smooth", block: "start" })`), wrapped in a `requestAnimationFrame`/`setTimeout(0)` so it runs after the results render.
   - In `mutation.onSuccess` (verify), do the same for `verifyResultsRef` after results are set.
3. **Keep both results visible** — no structural change needed; both sections already render independently.

### Optional polish
- Add a brief `toast.success` (e.g. "Formatting checked — see results below") so there is immediate in-view feedback even before the scroll, mirroring the existing error toasts.

## Verification
- Paste the example, click **Check formatting**, confirm the page smoothly scrolls to the colored grade cards.
- Click **Verify authenticity**, confirm it scrolls to the authenticity results.
- Confirm clicking with an empty box still shows the "Paste or upload…" toast.