Add a second filter row — "filter by source type" — to both the Verify authenticity and Check formatting result views. It works alongside the existing verdict/grade filters (both apply together, AND logic).

## 1. Authenticity view (source type filter)

`ReferenceResult` already has `type: "academic" | "web" | "offline"`. No backend change needed.

- In `src/routes/index.tsx`, add `typeFilter` state (`"all" | "academic" | "web" | "offline"`), persisted in sessionStorage alongside the other state.
- Render a second chip row under the existing verdict filters with: All, Academic, Web, Offline (each showing its count, hiding types with zero results).
- `filteredResults` becomes: match verdict filter AND match type filter.
- Labels: Academic = "peer-reviewed / scholarly (CrossRef, OpenAlex, arXiv…)", Web = "websites & online pages", Offline = "books & other non-online sources".

## 2. Formatting view (element type filter)

`FormatResult` has no type today, so add lightweight, browser-only element-type detection (no AI, no network) — similar to the type dropdown in Zotero.

In `src/lib/format-check.ts`:
- Add `export type ElementType = "journal-article" | "conference-paper" | "book" | "book-chapter" | "report" | "website" | "thesis" | "other"` and an `ELEMENT_TYPE_LABELS` map.
- Add `elementType: ElementType` to the `FormatResult` interface.
- Add a `detectElementType(ref)` heuristic and set it in `checkOne`. Detection order (first match wins):
  - thesis/dissertation/"PhD"/"master's" → Thesis
  - "proceedings"/"conference"/"symposium"/"workshop" → Conference paper
  - "technical report"/"working paper"/"white paper"/"report no." → Report
  - "In " + editor markers ("(ed", "eds", "editor") or "chapter" → Book chapter
  - DOI present, or journal markers ("journal", "vol.", "volume", "pp.", "no.") → Journal article
  - non-DOI URL with no journal markers → Website
  - publisher-like tail with no URL/DOI/journal markers → Book
  - otherwise → Other

In `src/components/FormatResultCard.tsx`:
- Show an outline badge with the element-type label next to the style badge.

In `src/routes/index.tsx`:
- Add `elementTypeFilter` state (persisted), render a second chip row of element types (only those present, with counts), and combine it with the existing grade sort/filter.

## Technical notes

- The "filter by type" chips reuse the existing `Button` + count styling; the source-type chips stay neutral (gray) so they don't clash with the green/yellow/red verdict colors already added.
- Element-type detection is heuristic (it can't always tell a book from a report in plain text) — surface it as a best-effort badge, consistent with the existing "formatting checks are heuristic" disclaimer.
- All filtering is client-side; no server function changes.