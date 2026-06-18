# Hero Section Redesign — Free Reference Checker

Refine the homepage hero (`src/routes/index.tsx`, lines 504–525) using your selected **Academic minimalist** direction. The redesign fixes the three issues you raised and keeps the existing functionality (input, upload, check buttons) untouched.

## What changes

### 1. Invert the typographic hierarchy
Per your note, the brand label becomes the dominant element and the headline shrinks below it:
- **Brand label** "Free Reference Checker" → large, bold display text (≈ `text-4xl`/`text-5xl`), the visual anchor of the section.
- A small uppercase eyebrow ("Reference authenticity & citation format") sits above it as a refined accent.
- **H1 headline** → smaller, lighter weight (≈ `text-xl`/`text-2xl`), describing what the tool does. Kept as the semantic `<h1>` for SEO even though it's visually secondary.

### 2. Match the paragraph width to the title
The description paragraph currently uses `max-w-2xl` while the title spans the full container. Both the headline and the paragraph will share the same `max-w-2xl` centered container so their line lengths line up cleanly.

### 3. Brand-inspired polish
Inspired by the social/OG brand image style (clean, academic, trustworthy):
- A prominent rounded brand icon tile at the top (using the existing `app-icon.png` / shield-check motif), centered.
- Centered hero layout with generous spacing and a subtle entrance.
- The "under development" notice is preserved, centered under the hero.

## Design system fidelity
The prototype used hardcoded `slate`/`blue` utilities. To stay consistent with the app's theming and dark mode, the implementation will use the project's **semantic tokens** (`text-foreground`, `text-muted-foreground`, `text-primary`, `bg-primary`, etc.) rather than literal colors — matching the same visual hierarchy and spacing as the chosen direction.

## Social media image
No change needed — the share image is already wired up: `og-image.jpg` (the branded 1200×630 graphic) is referenced in the homepage `head()` for `og:image` and `twitter:image`. It will keep showing when the link is shared.

```text
┌─────────────────────────────────────────┐
│                [ icon ]                   │
│        REFERENCE AUTHENTICITY (eyebrow)   │
│      Free Reference Checker  (LARGE)      │
│   Check reference authenticity… (smaller) │
│   ── paragraph, same width as headline ── │
│        [ under-development notice ]        │
└─────────────────────────────────────────┘
```

## Technical notes
- Only the `<header>` block (lines 504–525) in `src/routes/index.tsx` is edited; no logic, state, or server functions change.
- Optional subtle fade/slide-in entrance via existing CSS utilities (no new dependency).
- Text content of the headline and paragraph stays the same wording you have now.
