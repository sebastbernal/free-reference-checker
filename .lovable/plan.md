## Goal
Sort the formatting-check results so the worst (red / "Very bad") appear first, then yellow ("Needs improvement"), then green ("Perfect") — mirroring the severity-based ordering used for the authenticity-check results.

## Changes

1. **Add a `GRADE_ORDER` constant** in `src/routes/index.tsx` near the existing `VERDICT_ORDER`:
   ```
   red    → 0 (highest priority)
   yellow → 1
   green  → 2
   ```

2. **Sort `formatResults` before rendering** — in the `activeView === "format"` results block (around line 606), replace the direct `.map()` with a `.slice().sort()` using `GRADE_ORDER`, so results render in red → yellow → green order while preserving the original `n` field for display.

## Files to change
- `src/routes/index.tsx` only.