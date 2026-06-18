## What I tested (in a real browser, reproducing the preview's sandboxed iframe)

I embedded the running app in a sandboxed iframe (same conditions that cause your error) and clicked each search provider, checking whether the new tab actually loads:

```text
Provider                 Result in sandboxed preview
-----------------------  ---------------------------
Google (www.google.com)  BLOCKED  -> chrome-error (your ERR_BLOCKED_BY_RESPONSE)
Google Books             BLOCKED  -> chrome-error
Google Scholar           OPENED   (works today)
DuckDuckGo               OPENED
Open Library             OPENED
Bing                     OPENED
```

**Root cause (confirmed, not guessed):** the preview runs your app inside a sandboxed iframe. Any new tab it opens inherits that sandbox, and `www.google.com` / `books.google.com` return response headers that refuse to load in a sandboxed browsing context — that is the `ERR_BLOCKED_BY_RESPONSE`. Scholar, DuckDuckGo, Open Library, and Bing send no such restriction, so they open. Switching `<a>` to `window.open` does not help (I tested both); the blocker is Google, not how we open the link.

## The fix (every button uses a provider I verified opens)

Edit `src/lib/search-links.ts` to point the failing buttons at providers that actually work, keeping the same query text:

- **Scholar** -> `scholar.google.com` (unchanged, already works)
- **Books** -> Open Library: `https://openlibrary.org/search?q=...` (verified OPENED)
- **Web** -> DuckDuckGo: `https://duckduckgo.com/?q=...` (verified OPENED)
- **Bing** -> `https://www.bing.com/search?q=...` (verified OPENED)

In `src/components/ReferenceResultCard.tsx`, update button labels to match ("Google Scholar", "Open Library", "DuckDuckGo", "Bing"), and revert the buttons back to plain `<a target="_blank" rel="noreferrer">` links since these providers open normally — no `window.open` needed.

## Verification

After the change I will re-run the same sandboxed-iframe browser test against the live preview, click all four buttons on a failed reference, and confirm each new tab loads a real results page (no `chrome-error`). I will only report it fixed once that passes.

## Scope

- `src/lib/search-links.ts`: swap the two blocked Google URLs for Open Library + DuckDuckGo; add bing URL; query-building logic unchanged.
- `src/components/ReferenceResultCard.tsx`: relabel three buttons and add the fourth Bing button; revert to plain anchor links.
- No changes to verification logic, no API calls, no backend.

## Trade-off you should know

On your **published** site (not in a sandbox), the original Google links would have worked. I'm proposing DuckDuckGo + Open Library + Bing because they work in **both** the preview and the published site, so what you see while building matches production. If you'd rather keep Google on the published site and accept that those two buttons won't open inside the Lovable editor preview, tell me and I'll keep Google instead.