# Copy-paste URL repair for web reference verification

When references are pasted from a PDF/Word doc, a URL wrapped across a line can lose its hyphen (`science-everyone` → `scienceeveryone`), producing a real 404 for a genuine reference. This adds a bounded, parallel, HEAD-only repair attempt that runs **only** on URLs that already returned a genuine dead-page status — just before the Wayback archive fallback. Live URLs never reach this code, so they're unaffected.

## Step 1 — New file `src/lib/url-repair.ts`

Create the helper module with three exports/internals:

- `urlRepairCandidates(url, maxVariants = 6)` — splits off `?query`/`#fragment`, finds the single longest fused path segment (≥12 chars, all-lowercase, no existing hyphen), and re-inserts one hyphen at each interior boundary (chars 4 … len−4), capped at `maxVariants`. Returns `[original]` only when nothing is repair-worthy.
- `probeLive(url, timeoutMs = 6000)` — internal HEAD-only fetch with a short abort timeout; returns `true` for status < 400. No GET fallback so wrong candidates fail fast.
- `repairUrl(url)` — drops the original, probes the candidates in parallel via `Promise.any`, and resolves to the first live corrected URL or `null`.

This uses the exact file contents provided in the request.

## Step 2 — Import in `reference-check.functions.ts`

Add near the other local imports (after line 4 area):

```ts
import { repairUrl } from "./url-repair";
```

## Step 3 — Insert repair attempt before the Wayback fallback

In the `if (kind === "web")` block, directly before the case‑4 line `const wb = await waybackCheck(url);` (currently line 363), insert:

```ts
// 4a. The dead link may be copy-paste corruption (a hyphen dropped at a
//     line-wrap, e.g. "science-everyone" -> "scienceeveryone"). Try bounded,
//     parallel hyphenation repairs before falling back to the archive.
const repairedUrl = await repairUrl(url);
if (repairedUrl) {
  base.url = repairedUrl;
  base.verdict = "real";
  base.notes =
    `Live page found after correcting a copy-paste formatting error in the URL ` +
    `(original returned HTTP ${http.status}).${agingNote}`;
  return base;
}
```

## Scope / guarantees

- Cases 1–3, `runPool`, `waybackCheck`, and `reference-sources.server.ts` are unchanged.
- The `const wb = await waybackCheck(url);` line and everything after it stay exactly as-is.
- Bounded cost: ≤6 candidates, longest fused segment only, parallel HEAD probes ≈ one extra round trip, and only on genuinely dead URLs.

## Technical notes

- `base`, `http.status`, and `agingNote` are all in scope at the insertion point (verified at lines 302–310), so the inserted snippet compiles without further changes.
- `repairUrl` returns `null` when there is no repair-worthy segment or nothing resolves, in which case execution falls through to the existing Wayback logic untouched.
