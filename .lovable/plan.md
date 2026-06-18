## Problem

In the ReferenceResultCard, the Google Books and Google manual-search links show **"www.google.com is blocked / refused to connect / ERR_BLOCKED_BY_RESPONSE"** when clicked inside the Lovable preview iframe. Google Scholar works fine because scholar.google.com has different frame/popup policies.

## Root Cause

`<a href="..." target="_blank">` links to `www.google.com` are blocked by the browser when the app runs inside a sandboxed iframe. The iframe sandbox/security headers intercept or reject navigation to certain Google domains.

## Fix

In `src/components/ReferenceResultCard.tsx`, replace the three `<a>` tags (Google Scholar, Google Books, Google) in the manual-search block with `<button>` elements that call `window.open(url, "_blank", "noopener,noreferrer")` via `onClick`. User-initiated `window.open()` is treated as a popup request and bypasses iframe link restrictions.

## Scope

Only the manual-search link block inside ReferenceResultCard is touched. No changes to search-links.ts, verification logic, or any other component.