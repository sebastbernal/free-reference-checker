# Fix wrapped-URL parsing for pasted references

Two references failed because their URLs wrap across lines, and the parser's URL-repair logic mishandles those wraps.

## What's wrong

In `src/lib/parse-references.ts`, the `mergeWrappedUrl` helper rejoins a URL that broke across lines. It currently:

1. **Inserts a hyphen** at every wrap point (unless the line already ended in `-`). When a URL simply wraps mid-word, this corrupts it:
   - `…climate-ch` + `ange/…` → `…climate-ch-ange/…` (should be `climate-change`).
2. **Ignores fragments that start with a capital letter or contain no `-`/`/`**, so some wraps aren't rejoined at all:
   - `…HealthCaresClimate` + `Footprint_092319.pdf` stays split with a space → invalid link.

A related helper, `endsComplete`, has the same blind spot (it only collapses lowercase continuation fragments), which weakens new-entry detection for these cases.

## The fix

Word processors (Word, Google Docs) wrap long URLs **without** inserting a hyphen. So the correct repair is to **concatenate the fragments with no separator**, and to recognize capitalized-but-URL-like fragments as continuations.

### 1. `mergeWrappedUrl`
- Join URL fragments with an **empty string** instead of inserting `-`.
- Broaden the accepted continuation fragment to also match a capitalized/mixed token that is clearly URL-ish — i.e. it contains a digit, `_`, `.`, `-`, or `/` (e.g. `Footprint_092319.pdf`).
- Keep refusing to merge a plain capitalized word with no URL-ish characters (e.g. `Climate`), so the start of the *next* reference is never swallowed.

### 2. `endsComplete`
- Update its URL-collapse step to mirror the same broadened fragment rule, so a reference whose URL wraps into a capitalized fragment is still seen as "ending in a URL" and the following line is detected as a new entry.

## Verification

Re-run the parser against the user's pasted list and confirm:
- `…/5961/HealthCaresClimateFootprint_092319.pdf` (no space, valid).
- `…/plans/climate-change/global-green-and-healthy-hospitals` (no stray hyphen).
- Other references (Tomson, Sorensen, Watts, etc.) remain unchanged and correctly separated.

## Technical notes

- Only `src/lib/parse-references.ts` changes; this module is shared by both the authenticity verifier and the formatting checker, so both benefit.
- No behavior change for URLs that genuinely contain a trailing hyphen at the wrap point, since concatenation preserves any hyphen already present in the fragment text.
