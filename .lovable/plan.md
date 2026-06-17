## Goal
Switching between "Verify authenticity" and "Check formatting" should only change which view is shown — existing results (and the selected citation style) must be preserved and re-displayed when the user returns, instead of being wiped and re-run.

## Cause
- `handleCheck` always runs `setResults(null)` and re-fires the verify mutation.
- `handleCheckFormat` always runs `setFormatResults(null)` and resets `formatStep` to `"selecting"`.

So clicking a view button is currently "re-run", never "switch view". State already persists to sessionStorage, but the handlers clear it before the user can see it again.

## Changes (all in `src/routes/index.tsx`)

1. **Track the text that produced each result set** — add two state values: `verifiedText` and `formattedText` (strings). Set them when a check completes successfully.

2. **`handleCheck` (Verify button):**
   - Set `activeView = "verify"`.
   - If `results` already exist AND `text` is unchanged from `verifiedText`, just switch the view (show existing results) — do not clear or re-run.
   - Otherwise clear and run the mutation as today, and record `verifiedText = text` on success.

3. **`handleCheckFormat` (Check formatting button):**
   - Set `activeView = "format"`.
   - If `formatResults` already exist AND `text` is unchanged from `formattedText`, keep `formatStep = "done"` and the current `formatStyle` (results re-shown, style highlight preserved) — do not clear or reset.
   - Otherwise set `formatStep = "selecting"` and clear `formatResults` (as today). Record `formattedText = text` inside `handleSelectStyle` when the check runs.

4. **Persist the two new snapshot fields** in the save/restore `useEffect` (add `verifiedText` / `formattedText` to the serialized object and restore them), so the "unchanged text" check still works after a reload.

## Result
- Run verify → switch to formatting → switch back: verify results still there, not re-fetched.
- Run formatting with a style → switch away → return: formatting results and the chosen style remain.
- Editing the pasted text and clicking a view button still triggers a fresh check (text no longer matches the snapshot).