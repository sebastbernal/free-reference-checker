## Plan: Reduce Wayback Machine attempts to one

### Problem
`waybackCheck()` in `src/lib/reference-sources.server.ts` currently makes **2 attempts** with a 30-second timeout each, so a single slow or failing archive lookup can take up to 60 seconds. With concurrency of 4 references, this makes the whole check feel very slow.

### Change
In `src/lib/reference-sources.server.ts`, update `waybackCheck()`:
- Change `ATTEMPTS` from `2` to `1`.
- Remove the retry loop; call the CDX endpoint once.
- Keep the 30-second timeout on the single attempt so we still give slow archive servers a chance.

### Result
Each web reference gets **one** archive check instead of two, cutting the worst-case per-reference latency from ~60s to ~30s.