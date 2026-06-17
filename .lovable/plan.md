## Plan: Replace Alpha badge with development warning

### Summary
Remove the "Alpha" badge from the header and add a prominent warning-style notice that the tool is under development, advising users to independently verify results.

### Changes
1. **Remove the Alpha badge** — delete the `<span>` element at line 531-533 inside the header.
2. **Add a development warning banner** — insert a warning-styled alert (amber/yellow themed, matching existing alert patterns) near the top of the page, below the header description.

   **Warning text:** "This tool is currently under development — please verify all results independently before relying on them."

3. **Preserve existing warning** — keep the current amber warning banner that appears during verification ("This tool may occasionally misclassify authentic references..."), as it serves a different purpose.

### Technical details
- Use the existing `AlertTriangle` icon (already imported) for visual consistency.
- Reuse the same amber alert styling (`border-amber-200 bg-amber-50 text-amber-900` etc.) as the existing warning.
- The warning will be visible unconditionally (not tied to verification state) so users see it on page load.

### Files affected
- `src/routes/index.tsx`