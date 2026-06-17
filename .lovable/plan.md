Map each filter button (All, Real, Check, No trace, Archived, Offline, Inconclusive) to the same colors already used in `ReferenceResultCard`:

- Real → green (emerald)
- Check → yellow (amber)
- No trace → red
- Archived → sky blue
- Offline / Inconclusive / All → neutral gray

Reuse the existing `VERDICT_META` classes from `ReferenceResultCard` so the filter chips stay visually consistent with the result cards.

1. In `src/routes/index.tsx`, import `VERDICT_META` from `ReferenceResultCard` (or inline a small mapping if circular-import risk).
2. Update the filter-button render (lines ~586–614) so each button gets:
   - Inactive: a subtle tinted border/background matching its verdict color
   - Active: solid background in the same color family with contrasting text
3. Keep the badge count styling consistent — count text picks up the active/inactive color automatically.
4. Verify visually in the preview that the filter bar matches the card colors.