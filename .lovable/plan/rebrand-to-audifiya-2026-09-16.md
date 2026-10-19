# Rebrand to AudiFiya

Replace the old "Spotify"/"Musiks" naming everywhere with **AudiFiya**, and add an elegant cursive tagline.

## Logo and wordmark

- Sidebar header: "Audi" in bold white + "Fiya" in a green-to-emerald gradient, bold and tight-tracked. Collapsed (tablet) sidebar keeps just the circular icon.
- Welcome screen (first-run modal): same wordmark above the greeting instead of the plain "Welcome".
- Mobile top bar: the app header currently shows only back/forward and profile; add the compact AudiFiya wordmark on the left for small screens.

## Tagline

- Text: *where melody meets the heart*
- Cursive styling via the Google font "Great Vibes", loaded alongside the existing font link, exposed as a font token.
- Placed directly under the wordmark in the sidebar (only in the wide sidebar) and under the wordmark on the welcome screen, in a soft emerald tone, small, so it never crowds the nav links.

## Titles and metadata

- Browser tab title: `AudiFiya – Feel Every Beat` sitewide, with per-page titles `Home — AudiFiya`, `Search — AudiFiya`, `Your Library — AudiFiya`, `Liked Songs — AudiFiya`, `Playlist — AudiFiya`.
- Descriptions, social share titles, and author updated to AudiFiya.
- Add a web manifest named AudiFiya (short name AudiFiya) and link it, keeping the existing favicon.

## Technical notes

- Files: `src/routes/__root.tsx` (font link, manifest link, titles/meta), `src/components/Sidebar.tsx`, `src/components/AppShell.tsx`, `src/components/OnboardingModal.tsx`, `src/styles.css` (cursive font token + gradient text utility), route `head()` titles in `src/routes/{index,search,library,liked,playlist.$id}.tsx`, new `public/site.webmanifest`.
- Gradient text uses existing brand tokens via a small CSS utility, no hardcoded color utilities in components.
