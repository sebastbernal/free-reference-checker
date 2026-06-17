Plan: Citation style selector appears only after clicking Check formatting

Current state
- Citation style selector (APA 7th / MLA 9th / Harvard / Chicago 17th) is always visible above the two action buttons.
- Clicking Check formatting immediately runs the formatting check using the pre-selected style.

Desired behavior
- The citation style selector is completely hidden by default.
- When the user clicks Check formatting, the button becomes active/highlighted and the citation style selector appears directly below the buttons.
- The formatting check does NOT run when the button is clicked.
- Only after the user selects a citation style from the newly-shown selector does the formatting check execute and results appear.
- Clicking Verify authenticity hides the style selector and switches to the verify view as before.

Implementation steps

1. Remove the always-visible citation style block (lines ~412-426 in src/routes/index.tsx).

2. Add state to track the formatting flow:
   - `formatStep: "idle" | "selecting" | "done"` (or equivalent boolean `showStyleSelector`)
   - Default: "idle"

3. Update handleCheckFormat:
   - Instead of running checkFormatting immediately:
     a. Set activeView to "format"
     b. Clear any previous formatResults so the user can re-select
     c. Set formatStep to "selecting" to reveal the style selector
   - Do NOT call checkFormatting or set formatResults yet.

4. Update citation style onClick:
   - When a style button is clicked:
     a. Set formatStyle to the selected value
     b. Run checkFormatting(text, selectedStyle)
     c. Set formatResults
     d. Set formatStep to "done"
     e. Scroll to format results

5. Render the style selector conditionally:
   - Show below the action buttons only when activeView === "format" && formatStep === "selecting"
   - Use a small label like "Select citation style" above the buttons

6. Update Verify authenticity handler:
   - Set formatStep back to "idle" so the style selector disappears.

7. Session persistence:
   - Include formatStep in the sessionStorage save/restore logic alongside activeView and formatResults.

8. Edge cases:
   - If sessionStorage restores activeView="format" with existing formatResults, show results directly (formatStep="done").
   - If activeView="format" with no formatResults, show the selector (formatStep="selecting").

Visual result after paste + click Check formatting:
- Text area remains.
- Verify authenticity button is outline.
- Check formatting button is filled/default.
- Below the buttons: a compact row with label "Select citation style" and the 4 style buttons (APA 7th, MLA 9th, Harvard, Chicago 17th).
- User clicks APA 7th → formatting check runs → results appear below.
- User clicks Verify authenticity → style selector disappears, authenticity results appear.
