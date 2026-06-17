## Problem

Your reference list is recognized as **one** reference. Two things combine to cause it:

1. The list is one continuous run of text — no line breaks between references. (PDF text extraction in `file-extract.ts` joins everything with spaces, and your pasted version is also a single paragraph.)
2. `parseReferences()` in `src/lib/parse-references.ts` splits **only on newlines**. With no newlines, the entire block becomes a single entry.

## Fix

Add run-on splitting to `src/lib/parse-references.ts` so a block containing multiple references is broken apart by detecting each reference's date signature (`(2021, March 2)`, `(2024)`, `(n.d.)`, etc.), which marks the start of every APA entry.

### How it works

- After the existing newline-based grouping, post-process each entry: if it contains **2 or more** date signatures, split it; otherwise leave it unchanged. This works for both single-line PDF text and already-split lists.
- For each date after the first, find the boundary by walking backward from `(` over the preceding tokens, collecting author-like tokens (Title Case, initials, commas) and **stopping** at a URL-ish token (`://`, `/`, `www.`, `.com/.org/.au/.pdf…`, digits, or lowercase-leading). The split point is the start of the author phrase — this keeps each reference's full URL intact.
- Add a guard so slug-like fragments from broken URLs (tokens with 2+ internal hyphens, e.g. `Research-Collaboration-Project`) also stop the scan, while normal hyphenated surnames (e.g. `Smith-Jones`) are preserved.

### Verified result on your sample

Splits correctly into **6** references:

```text
[1] AAS. (2021, March 2)…science-climate-change
[2] ABS. (2024, December 6)…/2446/244634
[3] Australian Government. (2025, July 15)…ocean-climate connection
[4] IPCC. (2023, May 18)…IPCC_AR6_SYR_SPM.pdf
[5] Queensland Governement. (2024, August 2)…/Mangrove Research-Collaboration-Project
[6] Rob Moir, P. (2025, May 20)…by-caleb-leonard/
```

Each entry keeps its own URL so the existing liveness/Wayback checks run per reference.

### Notes / caveats

- These URLs already contain spaces (broken by the PDF/copy, e.g. `ocean-climate connection`). The existing cleanup that rejoins `https://… lowercase-fragment` handles most; some government URLs with spaces may still need the "confirm manually" verdict — that behavior is unchanged.
- No changes to verdict logic, `reference-check.functions.ts`, or any UI. This is purely the parsing step.

## Scope

- **File changed:** `src/lib/parse-references.ts` only.
- Verify by running the parser against your pasted sample (expect 6 entries) and re-checking that newline-separated lists still parse as before.
