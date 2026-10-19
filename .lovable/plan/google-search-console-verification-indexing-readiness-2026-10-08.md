# Google Search Console verification + indexing readiness

Make https://audifiya.lovable.app verifiable in Google Search Console and easy for Google to crawl and index.

## 1. Google site verification

- Create `public/google44eb0d093d1e7217.html` containing exactly `google-site-verification: google44eb0d093d1e7217.html` — the HTML file upload method Google asked for.
- Also add the meta-tag method as a backup in `src/routes/__root.tsx` head: `<meta name="google-site-verification" content="google44eb0d093d1e7217">`. Either method lets Search Console verify; having both is harmless.

## 2. robots.txt

- Create `public/robots.txt`:
  - `User-agent: *` / `Allow: /`
  - `Disallow: /audifiya-admin-panel` (admin page already carries noindex)
  - `Sitemap: https://audifiya.lovable.app/sitemap.xml`

## 3. sitemap.xml

- Create `public/sitemap.xml` listing the public, indexable routes with the published domain:
  - `/`, `/search`, `/library`, `/liked`
  - Excluded: `/audifiya-admin-panel` (noindex), `/playlist/*` and `/share/*` (per-user/ephemeral content).

## 4. Canonical URLs and og:url

- Add a self-referencing `<link rel="canonical">` and `og:url` to each public leaf route's `head()` (`index`, `search`, `library`, `liked`), all pointing at `https://audifiya.lovable.app/...`. Root keeps no canonical (TanStack concatenates links, so a root canonical would duplicate on every page).

## 5. Structured data

- Add a `WebSite` JSON-LD block in `__root.tsx` head (name AudiFiya, url https://audifiya.lovable.app) so Google gets a clean site entity.

## 6. Publish

- Verification and crawling read the live site, so the project must be published after these changes for Google to see them. Then in Search Console: verify property → submit sitemap → request indexing on the homepage.

## Technical notes

- Files: new `public/google44eb0d093d1e7217.html`, `public/robots.txt`, `public/sitemap.xml`; edits to `src/routes/__root.tsx` (verification meta + JSON-LD) and `src/routes/{index,search,library,liked}.tsx` (canonical + og:url).
- No changes to the admin route's existing `noindex, nofollow`.
