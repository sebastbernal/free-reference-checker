# Fix flickering 403/404 verdicts via a more reliable archive lookup

## What's actually happening

I reproduced both cases against the live Internet Archive API.

**Griffith** — the page now returns **HTTP 403**. It "worked before" because its server used to let our automated request through; it has since started blocking bots. On a 403 we fall back to the archive. Griffith *does* have snapshots (confirmed: captures through 2026), so the **correct** verdict is amber "check / confirm manually" — **not** red. A 403 is only a red flag when there is genuinely **no** snapshot.

**IPCC** — the page returns **HTTP 404**. It showed **"inconclusive"** because the archive lookup **timed out** and returned `error:` instead of a clean yes/no.

**Root cause for both:** the Wayback CDX query latency is wildly variable (measured 2s–30s for the same URL) and regularly exceeds the 15s timeout, returning `error:`. That `error:` then collapses otherwise-clear results into soft, flickering verdicts.

## The fix (lookup only — verdict logic unchanged)

### Harden the archive lookup (`waybackCheck`, `src/lib/reference-sources.server.ts`)
- Give it its own dedicated timeout of **30s per attempt**.
- **Two attempts total** (1 initial + 1 retry) on timeout/network error, for a **1-minute total wait** budget before giving up.
- Keep the existing CDX query and the three return shapes unchanged: `snapshot exists (YYYY)`, `NO snapshot ever`, `error: <name>`.

That's the only change. The verdict mapping in `src/lib/reference-check.functions.ts` stays exactly as it is — including the existing **`inconclusive`** result for a dead page whose archive can't be confirmed.

## Outcome
- The archive lookup returns a real yes/no far more often, so verdicts stop flickering.
- **Griffith (403, has snapshot):** stable amber "check — server blocked us, an archived snapshot exists, confirm manually".
- **IPCC (404):** when the slow lookup now succeeds, it resolves to its real verdict (`archived` if a snapshot exists, `no-trace` if none); only a genuine archive failure still falls back to `inconclusive` as before.

## Technical notes
- Only one file changes: `src/lib/reference-sources.server.ts` (30s timeout + one retry, 2 attempts / ~60s total, in `waybackCheck`).
- No changes to `reference-check.functions.ts` or `ReferenceResultCard.tsx`.
