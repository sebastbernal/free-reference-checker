## Problem

`waybackCheck` reports "no snapshot" for the CSIRO URL even though the Internet Archive has many captures (2021–2025).

Root cause: it queries `https://archive.org/wayback/available`, which does brittle exact-string matching. For this URL the `https://` form returns `archived_snapshots: {}` while only the `http://` form returns the snapshot — so we falsely report "NO snapshot ever". The CDX API (`web.archive.org/cdx/search/cdx`) finds the captures every time, normalizing scheme/trailing-slash.

Verified locally:
- `available?url=https://research.csiro.au/...` → `{}` (false negative)
- CDX → 5+ captures, most recent `20250720` (200)
- CDX for a fabricated URL → `[]` (correct true negative)

## Change

File: `src/lib/reference-sources.server.ts`, `waybackCheck` (lines 363–377).

Replace the `available` call with a CDX query that returns the most recent capture:

```text
GET https://web.archive.org/cdx/search/cdx
    ?url=<encoded>&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=-1
```

- `limit=-1` → returns only the most recent matching capture.
- Response is a JSON array; row[0] is the header. If a data row exists → `snapshot exists (YYYY)` using the first 4 chars of the timestamp.
- Empty array / only header → `NO snapshot ever`.
- Network/parse failure → `error: <name>` (unchanged behaviour, keeps the existing inconclusive path working).

Keep the same return-string contract (`"snapshot exists (YYYY)"` / `"NO snapshot ever"` / `"error: …"`) so every caller in `reference-check.functions.ts` and the card rendering keep working with no other edits.

## What does NOT change

- `reference-check.functions.ts` branch logic and verdict mapping — untouched; it only reads the returned string.
- `ReferenceResultCard.tsx` — untouched.

## Verification

After the edit, run the check on the CSIRO URL and confirm the card shows the archived snapshot instead of "no snapshot", and confirm a clearly fabricated URL still reports no snapshot.
