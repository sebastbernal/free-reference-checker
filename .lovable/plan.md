Move the **Clear** button from the verify-results header into the paste-reference toolbar area (top-right, next to "Try example" and "Upload").

**Why:** The button is currently buried under results; placing it on the input surface makes it discoverable before the user even runs a check.

**What changes:**
1. In the toolbar row above the textarea (where "Try example" and "Upload" live), add a **Clear** button that appears whenever `text.length > 0 || results != null || formatResults != null`. It uses the existing `clearAll` handler (resets text, results, filters, and session storage).
2. Remove the **Clear** button from the verify-results header row (the row that currently also holds "Export CSV").
3. Leave the formatting-side `clearFormat` button untouched for now — the new top-level Clear button already covers resetting the format state because `clearAll` is the global reset. If desired, we can wire the same `clearAll` into the format flow in a follow-up.

**Visual:** The toolbar becomes: `[Paste reference(s) label]`  `[Try example]` `[Upload]` `[Clear]`  — all aligned to the right, with Clear using the ghost variant and Trash2 icon like today.