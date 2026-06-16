Add a fixed donation bar at the bottom of the page linking to the user's PayPal.me.

- Add a heart icon donation button fixed to the bottom of the viewport (or a sticky footer bar) that links to https://paypal.me/sebastbernal.
- Opens in a new tab with `rel="noopener noreferrer"` for security.
- Uses a warm accent color (e.g., rose/pink) with a subtle pulse or hover effect to draw attention without being distracting.
- Ensures it doesn't overlap important content on mobile — add appropriate bottom padding to the main container.

Files to edit:
- `src/routes/index.tsx` — add the donation button component and adjust layout padding.

The button will say something like "Support this tool" or "Donate" with a heart icon, using lucide-react's `Heart` icon.