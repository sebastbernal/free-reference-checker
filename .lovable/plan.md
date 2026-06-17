# Swap in the rewritten reference-list splitter

## Goal
Replace the reference-splitting implementation with the rewritten version you provided, while keeping the exact `parseReferences(raw: string): string[]` signature and every downstream caller unchanged.

## Current state
- The shared parser lives in `src/lib/parse-references.ts` (hyphenated). It contains the old inline logic (`mergeWrappedUrl`, `splitRunOn`, `looksLikeStart`, etc.).
- Two files consume it, both importing from `./parse-references`:
  - `src/lib/format-check.ts` (citation-style checker)
  - `src/lib/reference-check.functions.ts` (authenticity verifier)

## Changes

### 1. Create `src/lib/parseReferences.ts`
Write the full 279-line file exactly as provided in the upload — the two-phase (SEGMENT then REPAIR) splitter that handles soft-wrapped URLs, dates split across lines, wrapped author lists, stray page numbers, zero-width characters, and Canvas markdown-link injection. It exports `parseReferences(raw: string): string[]`. No imports, pure and client-safe. Nothing else is added or modified.

### 2. Replace the body of `src/lib/parse-references.ts` with a re-export
Swap the old inline implementation for a single re-export so the new file becomes the one source of truth:

```text
export { parseReferences } from "./parseReferences";
```

This preserves the `./parse-references` import path that both callers already use, so `format-check.ts` and `reference-check.functions.ts` need no edits. The `parseReferences(raw: string): string[]` signature is identical.

## Explicitly NOT doing
- No changes to `format-check.ts` or `reference-check.functions.ts`.
- No signature changes, no reformatting of unrelated files, no extra "improvements".

## Verification
- Confirm the project still builds and that both call sites resolve `parseReferences` through `parse-references.ts` → `parseReferences.ts`.
