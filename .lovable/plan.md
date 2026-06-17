## Fix URLs broken across lines

### The problem
When a reference is copied from a PDF/Word doc, a long URL that wrapped onto the next line becomes a URL with a **space** in it, e.g.

```
https://www.goldcoast.qld.gov.au/Services/Projects-works/Mangrove Research-Collaboration-Project
```

Two things go wrong today:
1. The URL extractor stops at the first space, so only `…/Mangrove` is checked → false "dead link".
2. The existing repair in `parse-references.ts` rejoins the pieces with **nothing** (`Mangrove` + `Research` → `MangroveResearch`), which is also wrong.

I tested the four URLs from your assignment against the live sites: word processors break long URLs **at a hyphen and drop it**, so rejoining the pieces with a hyphen restores the real link. Result of the test:

```text
hyphen-join  -> 200  goldcoast … /Mangrove-Research-Collaboration-Project
hyphen-join  -> 200  oceanriver … /…-between-mangroves-and-marine-life-…
hyphen-join  -> 200  science.org.au/our-focus/science-everyone/…
hyphen-join  -> path correct (abs.gov.au/…/osca-occupation-standard-classification-australia/…)
empty-join   -> 404  (current behaviour)
```

So the fix is: **rejoin wrapped URL fragments with a hyphen.**

### The change
Edit only `src/lib/parse-references.ts` (shared by both the authenticity checker and the format checker — no other files touched).

Replace the current space-removing URL repair (the `\s+([a-z0-9%]…)` → `$1$2` step) with a small `mergeWrappedUrl` helper that, for each entry:
- Finds a `https?://…` token followed by a space and a continuation fragment.
- Rejoins them with `-` instead of deleting the space.
- Repeats until no more merges (handles URLs that wrapped multiple times).

To avoid swallowing legitimate trailing text after a URL, a fragment is only merged when it looks like a URL path piece:
- it contains a `-` or `/` (every real case above does), **or**
- it is entirely lowercase (a mid-word wrap),
- and it does **not** start with `(` or other sentence punctuation.

This also fixes the current bug where an **uppercase** continuation (`/Mangrove Research…`) was never merged at all, because the old regex only accepted lowercase continuations.

### Why this is safe
- `splitRunOn` still runs first, so each entry is already a single reference before URL repair — there is no adjacent reference whose author could be pulled into the URL.
- No changes to verdict logic, the HTTP/Wayback checks, server functions, or any UI.
- The HTTP check + Wayback fallback still handles any URL that a single hyphen-join doesn't perfectly reconstruct (e.g. a deep path that has since moved).

### Verification
Run the parser on your exact assignment text and confirm:
- 6 references are returned, each with a single space-free URL.
- The Gold Coast, Ocean River, and Australian Academy of Science URLs resolve (HTTP 200) and the ABS path is correctly hyphenated.
