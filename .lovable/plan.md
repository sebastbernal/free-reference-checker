## Problem
Both verify-authenticity and check-formatting results include a small `text-xs text-muted-foreground` caveat at the very bottom of the results block. Users miss it because it looks hidden.

## Goal
Relocate each caveat to sit **between the action buttons and the results block**, and upgrade the visual weight so it actually reads as a warning.

## Changes

### 1. Remove old caveat paragraphs
Delete the two current `text-xs text-muted-foreground` paragraphs:
- Verify caveat inside `{activeView === "verify" && counts && ...}` block (currently at bottom of results)
- Format caveat inside `{activeView === "format" && formatCounts && ...}` block (currently at bottom of results)

### 2. Add new prominent callouts below buttons
Insert new warning cards **just after the button row** (and after the citation-style selector when in format view), but **before** the loading spinners and results blocks.

- **Verify view**: Show when `activeView === "verify"` and (`mutation.isPending` or `results` exist).
  - Text: "This tool may occasionally misclassify authentic references — always double-check flagged items manually."
  - Style: `Alert` component or a card with `bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100` plus an `AlertTriangle` icon. Text size `text-sm`.

- **Format view**: Show when `activeView === "format"` and (`formatStep === "selecting"` or `formatResults` exist).
  - Text: "Formatting checks are heuristic and can't see italics in pasted text — treat the ideal version as a guide, not a final answer."
  - Same amber/warning card style.

### 3. Import `AlertTriangle` from `lucide-react`
Add to the existing icon import block.

### Visual outcome
Users will see the warning immediately after clicking a button, before results load, in a high-contrast amber callout that is impossible to miss.