Update `src/components/ReferenceResultCard.tsx` so the manual-search action area behaves differently for web sources.

### Current behavior
When a reference's verdict is `check`, `no-trace`, `offline`, or `inconclusive`, the card shows four manual-search links: Google Scholar, Open Library, DuckDuckGo, and Bing.

### New behavior
1. If `result.type === "web"` and the verdict is still in the manual-review set, hide the four search-engine buttons and instead render a single "Open original URL" button that links to `result.url`.
2. Keep the existing four search-engine buttons for `academic` and `offline` types.
3. The `result.url` already holds the repaired/live URL when the system successfully auto-repairs a broken URL, so the button naturally uses the live link.

### Files changed
- `src/components/ReferenceResultCard.tsx` — branch the manual-search render block on `result.type`.

### Not in scope
- No changes to `src/lib/search-links.ts`, the backend classification, or HTTP/archive checks.