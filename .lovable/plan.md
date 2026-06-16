I’ll fix the “How it works” section so clicking it reliably opens and closes.

Plan:
1. Replace the current accordion implementation for this section with a simple local React toggle button.
2. Keep the same visible title and content, but render the explanation when the toggle is open.
3. Add proper accessibility attributes (`aria-expanded`, `aria-controls`) so the button behavior is clear.
4. Preserve the existing layout and styling, changing only the broken expand/collapse interaction.