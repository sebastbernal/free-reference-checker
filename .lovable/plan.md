## Goal

Swap two implementations in the reference-checking pipeline with the exact code you provided. No refactoring, no signature changes, no other files touched.

## Changes

### 1. `src/lib/file-extract.ts` — full replace (FILE 1)
- Keeps the same two exports: `extractTextFromFile` and `sliceReferencesSection`.
- PDF branch reconstructs line breaks from each text item's vertical (Y) position via a new `pageItemsToText` helper instead of `join(" ")`, preserving one line per physical line.
- Expanded multilingual `HEADING_KEYWORDS` (EN/ES/IT/PT/FR/DE) and broader `STOP_KEYWORDS`, plus matching multilingual tokens in the inline-fallback regexes.
- New `cleanBoilerplate` helper strips running headers/footers, copyright lines, "downloaded from", and standalone page numbers; applied to all branches (txt/docx/pdf/fallback).
- Long-PDF optimization: only the last 60 pages are read.

### 2. `src/lib/parseReferences.ts` — full replace (FILE 2)
- Same `parseReferences(raw: string): string[]` signature.
- Adds a run-on fallback (`splitRunOnBlock`) so reference lists pasted without line breaks still split, gated to long blocks with 2+ date signatures so normal input is unaffected.

### Untouched (per your instruction)
- `src/lib/parse-references.ts` (the re-export shim) — no change.
- Every caller of these functions — signatures are unchanged.

## Verification
- Confirm both files keep their existing exports/signature.
- Confirm the build compiles (no missing imports; both new files only use `pdfjs-dist`/`mammoth` dynamic imports already present and standard JS).
