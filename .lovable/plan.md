## Plan: Fix double-hyphen in URLs wrapped across lines

### Problem
When references are pasted with each line preserved (multi-line paste), long URLs break at a hyphen and **keep** that hyphen at the end of the line:

```
https://science.org.au/our-focus/science-
everyone/science-climate-change
```

The current `mergeWrappedUrl` always rejoins fragments with `-`, so it produces `science--everyone` (a double hyphen) — a broken URL that then fails verification even though the link is real.

The single-line paste of the same references drops the hyphen at the wrap point, so it joins correctly to `science-everyone`. Hence the inconsistency between the two paste methods.

### Fix (one change in `src/lib/parse-references.ts`)
In `mergeWrappedUrl`, only insert a `-` when the URL fragment does **not** already end with one. Join logic becomes:

```
`${url}${url.endsWith("-") ? "" : "-"}${frag}`
```

- Multi-line paste (`science-` + `everyone`) → already ends with `-` → join with nothing → `science-everyone`.
- Single-line paste (`science` + `everyone`) → no trailing `-` → add `-` → `science-everyone`.

Both paste methods now produce identical, correct URLs.

### Verification
Re-run the parser against both of the user's exact pastes (multi-line and single-line) and confirm every URL matches (no `--`), e.g. `osca-occupation-standard-...`, `Mangrove-Research-Collaboration-Project`, and `the-critical-connection-between-mangroves-and-marine-life-...`.