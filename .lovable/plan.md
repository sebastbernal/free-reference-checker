## Goal

Unify the site metadata under **"Free Reference Checker"** and make the social image actually render when the link is shared on **WhatsApp** (and other platforms).

**Description to use everywhere:**
> Verify the Authenticity of Academic & Website References Easily, Instantly and Free.

## Why the WhatsApp image isn't showing

The current `og:image` (`storage.googleapis.com/.../45e88c23...`) is a **718 KB PNG**. WhatsApp only renders preview images under roughly **300 KB** and works most reliably with a 1200×630 JPG served over HTTPS with explicit dimensions. The oversized PNG is why WhatsApp shows the link with no image.

## Changes

### 1. New optimized share image
- Create a **1200×630 JPG under ~300 KB** (derived from the existing app icon / brand) and add it to the project at `public/og-image.jpg` so it's served from `https://free-reference-checker.lovable.app/og-image.jpg` (the project's own HTTPS domain, with a real `.jpg` extension WhatsApp likes).

### 2. `src/routes/index.tsx` — homepage `head()`
- `title` → **"Free Reference Checker"**
- `og:title` / `twitter:title` → **"Free Reference Checker"**
- `description` / `og:description` / `twitter:description` → the new description above
- Add `og:url` + leaf `canonical` → `https://free-reference-checker.lovable.app/`
- Add the WhatsApp-friendly image tags (absolute URLs):
  - `og:image` → `https://free-reference-checker.lovable.app/og-image.jpg`
  - `og:image:secure_url` → same URL
  - `og:image:type` → `image/jpeg`
  - `og:image:width` → `1200`, `og:image:height` → `630`
  - `og:image:alt` → short description
  - `twitter:image` → same URL, `twitter:card` → `summary_large_image`

### 3. `src/routes/__root.tsx` — sitewide defaults
- Keep `title: "Free Reference Checker"`; update `description` / `og:description` / `twitter:description` to the new description.
- Remove the old 718 KB `og:image` / `twitter:image` from the root (a root-level image overrides every page). Keep `og:type: website`, viewport, charSet, favicon, author, and `twitter:site` here.

## WhatsApp specifics being addressed

- Image under 300 KB ✔
- Absolute HTTPS URL with `.jpg` extension ✔
- Explicit `og:image:width` / `og:image:height` / `og:image:type` ✔ (WhatsApp uses these to decide whether to fetch/show the image)

## Result

Tab, WhatsApp/Facebook/LinkedIn/Twitter previews, and the Share-menu settings all read **"Free Reference Checker"** with the one description and a properly rendering share image.

## Notes

- WhatsApp aggressively caches link previews. After publishing, an already-shared link may keep the old (image-less) preview for a while; sharing the URL with a cache-buster (e.g. `?v=2`) or waiting for the cache to expire forces a refresh.
- This is a frontend change — it goes live after you click Update/Publish.
