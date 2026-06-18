## Add manual-search buttons to failed reference verifications

Three small, display-only changes — no verification logic is altered.

### 1. Create `src/lib/search-links.ts`
New utility that builds Google Scholar, Google Books, and Google search URLs from a reference string and its cited title. Pure URL construction, no API calls.

### 2. Add imports to `src/components/ReferenceResultCard.tsx`
Import `buildSearchLinks` from the new utility and the `Search` icon from `lucide-react`.

### 3. Insert button block inside `ReferenceResultCard`
Immediately after the closing `</dl>` and before the closing `</CardContent>`, render a row of three search links (Google Scholar, Google Books, Google) when the verdict is one of: `check`, `no-trace`, `offline`, or `inconclusive`. Each link opens in a new tab. Real and archived verdicts never show these buttons.

### Files touched
- `src/lib/search-links.ts` — new file
- `src/components/ReferenceResultCard.tsx` — imports + JSX insertion

### No changes to
- Verification algorithms
- Verdict types
- Any other component behavior