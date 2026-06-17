# Optimize multi-line reference detection

## Problem

The textarea accepts pasted reference lists, but real-world paste (e.g. copied from a PDF/Word doc) wraps a single reference across several lines and even splits URLs across lines. The current parser in `src/lib/reference-check.functions.ts` (`parseReferences`, lines 51–92) decides "this line starts a new reference" using a single rule: *the line starts with a capital letter*. This misfires badly on the pasted sample:

- Author lists wrapping mid-name get split into bogus extra references:
  - `…van Kerkhoff, L., &` / `Cook, C. (2020)…` → split incorrectly
  - `…Larsen, F. W., &` / `Margules, C. (2021)…` → split incorrectly
- Title lines wrapping to a capitalized word get split:
  - `…Standard Classification of` / `Occupations (ANZSCO)…` → split incorrectly
- Web references that end on a URL (no trailing period) fail to trigger the *next* real reference correctly.
- Book/publisher continuation on its own line (`A life on our planet… future.` / `Ebury Publishing.`) gets split.

## Fix

Rewrite the "new entry" decision in `parseReferences` so it uses **two signals together** instead of just "starts with a capital":

1. **The current buffer looks complete** — it ends with a sentence period / closing paren, OR ends with a URL (covers web refs with no trailing period).
2. **The new line looks like the real start of an APA reference** — it is a numbered marker (`1.`, `[1]`, `(1)`), OR matches an author pattern (`Surname, X.`), OR contains a year token early (`(YYYY)` / `(n.d.)`) as happens with organization authors like `United Nations. (2015)` or `Healthy Land & Water. (n.d.)`.

A line only begins a new reference when **both** are true; otherwise it is appended to the current reference. This keeps wrapped author lists, wrapped titles, and split URLs attached to the correct reference while still separating genuine new entries.

Also keep/strengthen the existing URL-rejoin step so URLs split across lines (e.g. `…science-climate-` + `change`, `…essd-15-5301-` + `2023`) are stitched back into a single URL. Blank lines between wrapped fragments continue to be ignored (they already are).

No UI, server, or business-logic changes beyond this parsing function — the textarea, server function, and verification stages stay the same.

## Technical detail

In `src/lib/reference-check.functions.ts`, replace the `isNewEntry` helper and the accumulation loop (≈ lines 60–84) with logic equivalent to:

```text
endsComplete(buffer):
  trim; true if it ends with a URL (/https?:\/\/\S+$/)
        or ends with . ) ] (sentence/paren terminator)

looksLikeStart(line):
  reject if starts with http / www. / doi
  true if numbered marker  ^(\[\d+\]|\(\d+\)|\d+[.)])\s+
  true if author pattern   ^[A-Z][\w'’.-]+,\s+[A-Z]\.
  true if early year token  (YYYY) or (n.d.)  near the start
  else false

isNewEntry(line, buffer) = endsComplete(buffer) && looksLikeStart(line)
```

Loop unchanged otherwise: skip blank lines, append continuation lines with a space, push buffer when `isNewEntry` fires. Keep the post-processing URL-join and whitespace-collapse (lines 86–91).

## Validation

After the change, run the pasted sample through the parser (a quick local script or the live preview) and confirm:
- The Wyborn, Williams, Friedlingstein, Ens, and Lindenmayer entries each parse as **one** reference (no mid-author splits).
- The ABS / CSIRO / Griffith / Leeds entries keep their wrapped titles and reassembled URLs intact.
- `Attenborough … Ebury Publishing.` and `Irwin … Allen & Unwin.` parse as single book references.
- Total parsed count matches the ~19 distinct references in the sample.
