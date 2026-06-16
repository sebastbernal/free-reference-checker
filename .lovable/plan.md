# Reference Checker — web tool

A single-page tool that takes a pasted or uploaded reference list, verifies each
entry, and shows a **verdict card per reference** on the page (no CSV required,
with an optional export button). It combines the academic verification of
CheckIfExist (CrossRef + Semantic Scholar + OpenAlex + arXiv + DBLP) with the web-link
checking from your Python script (live HTTP status + Wayback fallback).

## What it does, per reference

1. **Parse** the pasted/extracted text into individual references (rejoins
   wrapped lines, strips trailing source tags, repairs split URLs) — ported from
   your Python `parse_references`.
2. **Classify** each as **academic** (has DOI or looks like a paper),
   **web** (has a URL, no DOI), or **offline** (book / no link).
3. **Academic check** — look up across CrossRef, Semantic Scholar, OpenAlex,
   arXiv, and DBLP. A DOI is resolved directly; otherwise the title is searched.
   Compares the cited title against the matched title (similarity score) and flags
   mismatches.
4. **Web check** — HEAD/GET the URL for a live status; if dead/errored, query the
   Wayback Machine for a historical snapshot.
5. **Verdict** — one clear status per reference:
   - `Real` (academic match found, or web page live)
   - `Check` (DOI/title not found, or title mismatch — possibly fabricated)
   - `Dead link, but archived` (web page down but Wayback snapshot exists)
   - `No trace` (web page down and never archived — likely fabricated)
   - `Offline source` (book — cannot auto-verify)

## Result presentation (on-page cards, lean)

Each reference renders a card showing:
- Status badge (color-coded: green Real / amber Check / red No trace / grey Offline)
- The original reference text
- Type (academic / web / offline)
- Which source confirmed it (e.g. "Found in OpenAlex") + matched title
- For web: HTTP status + archive result
- Short notes / reason for the verdict

A summary bar at the top counts totals (e.g. "12 checked · 9 real · 3 flagged").
An optional **Export** button downloads the results as a CSV/JSON report.

## Inputs

- **Paste text** into a textarea (APA / numbered / plain references).
- **Upload** `.txt`, `.docx`, `.pdf` — file text is extracted in the browser
  (`.txt` read directly, `.docx` via `mammoth`, `.pdf` via `pdfjs-dist`), then the
  plain text is sent to the checker. A "Try example" link loads sample references.

## Technical design

**Why server-side checks:** browser CORS blocks arbitrary URL liveness checks and
some scholarly APIs. All network verification runs in a TanStack server function;
the browser only does file-text extraction and rendering.

- `src/lib/reference-check.functions.ts` — `createServerFn` (POST) taking the raw
  reference text (Zod-validated: max references, max length). It parses,
  classifies, and for each reference runs the source lookups + web checks with a
  concurrency limit and per-item error handling, returning a plain array of
  result DTOs. No API keys needed (all endpoints are free/open); sends a polite
  `User-Agent`.
- `src/lib/reference-sources.server.ts` — helper module with one function per
  source (CrossRef, Semantic Scholar, OpenAlex, arXiv, DBLP, HTTP liveness,
  Wayback) plus title-similarity scoring (Levenshtein + word-overlap, ported from
  the original tool). Imported only by the server function.
- `src/routes/index.tsx` — the page: header, paste/upload input, check button,
  progress indicator, summary bar, and the list of verdict cards. Calls the
  server function via `useServerFn` inside a mutation (not in a loader). Uses
  existing shadcn `card`, `badge`, `button`, `textarea`, `progress` components.
- `src/components/ReferenceResultCard.tsx` — the per-reference card.
- Client file parsing util using `mammoth` + `pdfjs-dist` (added with `bun add`).
- SEO: real `<title>`/meta/H1 for the index route.

## Out of scope (for now)

- Saving check history (would need a database / Lovable Cloud).
- Citation reformatting (APA/MLA/BibTeX corrected output) — you chose the lean
  verdict cards, so this is skipped.
- Retraction database lookup beyond what OpenAlex/CrossRef metadata exposes.

## Verification

Run a mixed sample through the tool — a real DOI, a fabricated DOI, a real
title-only paper, a live URL, and a dead URL — and confirm each gets the correct
verdict and the cards render correctly in the preview.