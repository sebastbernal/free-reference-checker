The "How it works — what happens behind the scenes" collapsible section currently only explains the Verify authenticity flow. We will make it context-aware so its content changes depending on which button is active.

### Changes
1. In `src/routes/index.tsx`, wrap the inner content of the `showHow` block (lines 646-749) in a conditional:
   - If `activeView === "format"`, show formatting-specific explanation.
   - Otherwise, show the existing verify-authenticity explanation.

### New formatting content
- **Opening paragraph**: Explain that the formatting checker compares references against the selected citation style using heuristic, rule-based logic — explicitly noting it does **not** use any AI or large language model, so results may not be very accurate.
- **Step 1 — Parsing**: Split text into individual references; look for authors, years, titles, journals, volume/issue, pages, URLs.
- **Step 2 — Rule checking**: Score each reference against the chosen style (APA 7th, MLA 9th, Harvard, Chicago 17th). List typical checks: author formatting, year placement, title casing, journal/publisher info, punctuation.
- **Step 3 — Grading**: Explain the green/yellow/red grades.
- **Disclaimer**: Mention that because it is rule-based and cannot see italics/indentation in plain pasted text, results are approximate and should be compared against the official style manual.

### Existing verify content
- Keep unchanged but update the opening sentence to say "when you press Verify authenticity" instead of "Check references".

No other files need to change.