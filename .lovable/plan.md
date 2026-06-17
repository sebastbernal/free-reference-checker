## Goal
Replace the current tabbed UI ("Verify authenticity" / "Check formatting") with one shared reference-paste area and two action buttons below it.

## What changes

1. **Remove `<Tabs>` entirely** — the `Tabs`, `TabsList`, `TabsContent` wrapper goes away.
2. **Unify to one shared textarea** — combine `text` and `formatText` into a single `text` state. One `<Textarea>` with one set of upload / example controls.
3. **Two buttons below the textarea** — side-by-side (or stacked on mobile):
   - **Verify authenticity** (left, primary or outline) — runs the existing server-side check.
   - **Check formatting** (right) — runs the client-side format check.
4. **Move the style selector** — the four citation-style buttons (APA 7th, MLA 9th, etc.) move to a compact row between the textarea and the action buttons (or directly above the "Check formatting" button).
5. **Keep both result sections** — verify results and format results render independently below the card when they exist. Each keeps its own filters, counts, clear button, and result cards.
6. **Update sessionStorage persistence** — drop the `tab` field; store only the unified `text`, both result sets, and `formatStyle`.
7. **Remove unused imports** — `Tabs`, `TabsList`, `TabsContent`, `TabsTrigger` and the `tab` state.

## Files to edit
- `src/routes/index.tsx` — main layout refactor.

## No new files or dependencies needed.

## Verification
- Paste example text, click each button, and confirm both verify results and format results render correctly without tabs.
- Confirm sessionStorage restore still works after a page reload.