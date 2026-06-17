## Goal
Keep one shared paste area, but make the two buttons below it behave like a toggle/tabs: only one result set is shown at a time, and the active button is visually highlighted (selected color).

## Behavior
- Click **Verify authenticity** → runs the authenticity check, highlights that button, and shows ONLY the authenticity results.
- Click **Check formatting** → runs the formatting check, highlights that button, and shows ONLY the formatting results.
- The other result set is hidden while the other mode is active.

## Changes in `src/routes/index.tsx`
1. **Add an `activeView` state** — `"verify" | "format" | null` (start `null` so nothing shows until a button is clicked). Persist it in sessionStorage alongside the other state.
2. **Set the view on click:**
   - `handleCheck` (verify) → `setActiveView("verify")` before running.
   - `handleCheckFormat` → `setActiveView("format")`.
3. **Highlight the active button:**
   - Verify button: `variant={activeView === "verify" ? "default" : "outline"}`.
   - Format button: `variant={activeView === "format" ? "default" : "outline"}`.
   (Both currently render as primary/secondary; switch to the active/outline pattern so the selected one stands out.)
4. **Show only the active results:**
   - Authenticity results block renders only when `activeView === "verify"` (and `counts` exists / loading).
   - Formatting results block renders only when `activeView === "format"` (and `formatCounts` exists).
5. Keep the existing auto-scroll to results.

## Verification
- Paste the example, click **Check formatting** → only formatting grades appear, that button is highlighted.
- Click **Verify authenticity** → formatting results disappear, only authenticity results show, that button is now highlighted.
- Reload → the last active view and its results are restored.