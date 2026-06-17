# Improve web-link verification: blocked links, network errors & outdated pages

Three fixes, all in the web-link path. No new verdict type — blocked links and outdated pages both use the existing yellow **Check** verdict, per your choices (threshold = 5 years).

## 1. Use a browser-like request & capture freshness data
`src/lib/reference-sources.server.ts` → `httpCheck()`

- Send a real browser `User-Agent` plus `Accept`/`Accept-Language` headers (the current `RefChecker/1.0` UA gets some university/gov sites to block).
- Change the return value from a bare status string to `{ status, lastModified, finalUrl }` so the caller can read the `Last-Modified` header for the age check.
- Keep the existing HEAD→GET fallback and `redirect: "follow"`.

## 2. Stop mis-flagging live-but-protected links and network errors
`src/lib/reference-check.functions.ts` → web branch of `processReferenceCore()`

Re-map outcomes:

```text
status < 400 (2xx/3xx)        -> Real (then apply age check, step 3)
401 / 403 / 405 / 429 / 451   -> Check  "Server responded (HTTP NNN) but blocked
                                          automated verification — the page exists,
                                          confirm manually."
404 / 410                     -> dead: Wayback fallback (unchanged: archived / no-trace)
other >= 400                  -> dead: Wayback fallback
network/timeout error         -> Check  "Couldn't reach the page from our server
                                          (network error) — sites sometimes block
                                          automated requests. Verify manually."
                                          (look up Wayback; if a snapshot exists,
                                          add it to the note)
```

Key behavior change: a **network error is no longer routed into the "no-trace / possibly fabricated" branch** — that was the CSIRO false negative. Only a real `404`/`410` (or other definite ≥400 that isn't a known block code) with no archive yields "no-trace". This fixes both CSIRO (network/IP block) and Leeds (403).

## 3. Detect outdated pages (5+ years old)
New helper in `reference-sources.server.ts`, used in the web branch.

Determine a "content year" from the most reliable signals available:
- A 4-digit year (`19xx`/`20xx`, ≤ current year) found in the **URL path** and in the **reference text** (e.g. ABS URL contains `2013`).
- The `Last-Modified` header year **only when it's plausibly old** (older than now). ABS returns today's date, so it's ignored there — the `2013` in the URL still triggers the flag.

Rule: if a live page's content year is **≥ 5 years** older than the current year, downgrade the verdict from **Real → Check** and append a note:

```text
"Live page (HTTP 200), but the source looks dated (2013) — confirm it hasn't
 been superseded by a newer version."
```

Pages with no detectable year stay **Real**. The age note is also appended to blocked/`Check` links when a year is detectable.

## 4. Minor copy update
`src/routes/index.tsx` verdict legend: extend the **Check** entry to mention it now also covers "live but blocked or possibly outdated pages" so the yellow badge's meaning is clear.

## Technical notes
- `httpCheck`'s new object return requires updating its single call site in `processReferenceCore`; `base.httpStatus` keeps showing the numeric status string.
- No UI/component changes beyond the legend copy — `Check` is already the amber badge in `ReferenceResultCard.tsx`.
- Block-code list is conservative (401/403/405/429/451) so genuine 404s still get flagged as dead.

## What this fixes
- **CSIRO** → no longer "possibly fabricated"; live or, if the server's fetch is blocked, shown as **Check** (reachable, verify manually).
- **Leeds** → 403 now shown as **Check** ("server exists, blocked"), not a dead/fabricated link.
- **ABS** → still reachable, now **Check** with a "dated 2013, may be outdated" note.
