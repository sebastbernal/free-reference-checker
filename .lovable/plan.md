## Goal

For a web reference whose server **blocks** automated verification (case 2: HTTP 401/403/405/429/451), run the Wayback/snapshot lookup so the card always shows an archive status — and downgrade the verdict to **red** when no snapshot ever existed (a blocked page that was never archived likely never really existed).

## Change

File: `src/lib/reference-check.functions.ts`, blocked branch (case 2, lines 325–331).

Today this branch returns early with `verdict = "check"` and never sets `base.wayback`, so the card shows no archive line. Replace it so it runs `waybackCheck(url)`, stores the result, and picks the verdict from the snapshot outcome:

- **Snapshot exists** (`"snapshot exists (YYYY)"`) → `verdict = "check"` (amber). Note: server blocked verification but an archived snapshot exists + aging note.
- **No snapshot ever** (`"NO snapshot ever"`) → `verdict = "no-trace"` (**red**). Note: server blocked (HTTP code) and the page was never archived — likely fabricated.
- **Lookup inconclusive** (`"error: …"`, archive itself unreachable) → `verdict = "check"` (amber). Note: server responded but blocked, archive status couldn't be confirmed — verify manually + aging note.

In every sub-case `base.wayback` is set, so the card renders the archive line consistently instead of silently omitting it.

## What does NOT change

- `ReferenceResultCard.tsx` — already renders `result.wayback` when non-empty, and `no-trace` already maps to red.
- Cases 1 (live), 3 (network error), 4 (dead page) — untouched.

## Technical detail

```text
// case 2 (blocked) becomes:
const wb = await waybackCheck(url);
base.wayback = wb;
if (wb.startsWith("snapshot")) {
  base.verdict = "check";
  base.notes = `Server responded (HTTP ${code}) but blocked verification — an archived ${wb} exists.${agingNote}`;
} else if (wb === "NO snapshot ever") {
  base.verdict = "no-trace";
  base.notes = `Server blocked verification (HTTP ${code}) and the page was never archived — likely fabricated.`;
} else {
  base.verdict = "check";
  base.notes = `Server responded (HTTP ${code}) but blocked verification; archive status could not be confirmed (${wb}). Verify manually.${agingNote}`;
}
return base;
```
