# Site Icon for Free Reference Checker

A custom minimal icon to replace the generic `ShieldCheck` lucide icon in the header and serve as the browser favicon.

## Concept

The app verifies that citations/references are real. A fitting minimal mark combines a **checkmark inside a rounded square**, with a subtle reference/citation cue. Direction:

- A rounded-square badge in the brand's deep navy (`--primary`) with a clean white checkmark, paired with a short underline "reference line" beneath it to evoke a verified citation entry.

This stays minimal, reads clearly at 16px (favicon) and 24-32px (header), and matches the existing restrained navy/neutral palette.

## What gets built

1. **Generate the icon asset**
   - Create a crisp PNG/SVG-style mark (transparent background) saved to `src/assets/`.
   - Also produce a favicon-friendly version (square, works small).

2. **Header logo** (`src/routes/index.tsx`, lines ~511-518)
   - Replace the `<ShieldCheck className="h-6 w-6" />` with the new icon image, keeping the "Free reference checker" label and "Alpha" badge alongside it.
   - Remove the now-unused `ShieldCheck` import if it isn't used elsewhere.

3. **Favicon** (`src/routes/__root.tsx`)
   - Add `<link rel="icon">` tags in the root route `head()` pointing to the favicon asset so it shows in browser tabs and bookmarks.

## Technical notes

- Icon generated via the image tool with a transparent background, then referenced as a normal asset import.
- Favicon wired through the root route head (the supported place for `<link>` tags in this TanStack stack), not via a `public/` folder.
- Purely presentational change — no logic, data, or backend changes.

## Open choice

I picked a navy rounded-square checkmark as the default direction since you had no specific preference. If you'd rather see a different motif (e.g. magnifying glass, book, quotation mark), tell me and I'll adjust before implementing.
