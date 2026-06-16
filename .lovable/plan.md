## Update floating support button

Replace the single PayPal link in the fixed bottom bar with a layout that offers both PayPal and a card-payment option, using a generic label most users will recognise.

### Changes
1. In `src/routes/index.tsx`, replace the single `<a>` PayPal button (lines 628-637) with a floating pill containing:
   - A leading heart icon + "Support this tool" label.
   - Two side-by-side text links:
     - **PayPal** → `https://paypal.me/sebastbernal`
     - **Card** → `https://buymeacoffee.com/sebastbernal` (Buy Me a Coffee accepts cards without an account; the generic label is clearer for users unfamiliar with the brand).
   - Both links open in a new tab (`target="_blank" rel="noopener noreferrer"`).
2. Keep the existing styling approach: rounded-full pill shape, rose-600 background, white text, shadow, hover scale, focus ring. Separate the two links with a subtle vertical divider (`border-white/30`) and a small gap.

### Visual approach
```text
[♥ Support this tool | PayPal · Card]
```

### Out of scope
- No new packages needed.
- No backend changes.