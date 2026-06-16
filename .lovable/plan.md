# Add MIT License & Credits (with links)

## 1. LICENSE file
Create a standard `LICENSE` file at the project root with the MIT License text, copyright `2026 Sebastian Bernal Garcia`.

## 2. Footer credit (always visible)
Add a small footer at the bottom of the home page (`src/routes/index.tsx`) showing:
- `Built by Sebastian Bernal Garcia · MIT License · 2026`
- `Sebastian Bernal Garcia` links to: `https://www.linkedin.com/in/sebastianbernalgarcia/`

## 3. Expandable "About & Credits" section
Add a second collapsible toggle (mirroring the existing "How it works" pattern with `useState`, a button, `ChevronDown`, and `aria-expanded`/`aria-controls`) directly above the footer. When expanded it explains:
- What the project is and that it runs all checks live with nothing stored.
- **Credits / acknowledgements:**
  - Academic verification approach is **inspired by checkifexist** — `checkifexist` links to `https://zabbonat.github.io/References-Validation/`
  - Web-page liveness + Wayback checking is **an original creation by the author**.
- Licensed under the **MIT License**.
- Author: **Sebastian Bernal Garcia** (links to `https://www.linkedin.com/in/sebastianbernalgarcia/`).

## Technical notes
- Reuse the existing collapsible markup pattern already used for "How it works" (new `showAbout` state).
- No new dependencies; `ChevronDown` and `Info` are already imported.
- Only `src/routes/index.tsx` is edited; `LICENSE` is added at root.
