## Add verdict-status filter to results

### What
Add a toggle/filter bar above the result cards so the user can show only references matching a specific verdict (e.g. Real, Check, No trace, Archived, Offline, Inconclusive). The filter defaults to **All**.

### UI
- Insert a horizontal row of pill / toggle buttons between the summary counts and the result list.
- Options: **All** | **Real** | **Check** | **No trace** | **Archived** | **Offline** | **Inconclusive**
- Active pill gets the standard primary/accent styling; inactive pills are subtle outline style.
- Filter state is local React state (`useState<Verdict | 'all'>`).

### Data / Logic
- In `src/routes/index.tsx`:
  - Derive a `filteredResults` array from `results` based on the current filter selection.
  - When filter is `'all'`, show every result.
  - Otherwise show only results whose `verdict` matches the selected value.
- Keep the top summary counts always showing **total** numbers (not filtered), so the user still sees the overall scan summary.
- Render the card list from `filteredResults`; if empty after filtering, show a small "No results for this filter" message.

### Files
- `src/routes/index.tsx` — add filter state, UI row, and filtered rendering.
- `src/components/ui/toggle-group.tsx` — reuse existing shadcn ToggleGroup for the pills (no new dependency).