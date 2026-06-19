## Summary
Add a "Wayback Machine" button next to the existing "Open URL" button in the inconclusive auto-verification section for web references.

## Changes

### `src/components/ReferenceResultCard.tsx`
In the `result.type === "web" && result.url` branch (around line 165–181), insert a second button linking to `https://web.archive.org/web/*/{result.url}`.

- Use the existing `btn` class string for consistent styling.
- Use the Archive icon (already imported from `lucide-react`) for the button.
- Label: "Wayback Machine".
- Behavior: `target="_blank" rel="noreferrer"`.

### No other files changed.

## How to verify
1. Trigger a reference check with a web URL that returns an inconclusive/check/no-trace verdict.
2. Confirm both "Open URL" and "Wayback Machine" buttons appear side by side.
3. Click "Wayback Machine" and confirm it opens `https://web.archive.org/web/*/{url}`.