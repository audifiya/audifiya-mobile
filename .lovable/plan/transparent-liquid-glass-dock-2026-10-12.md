# Transparent Liquid Glass Dock

## Goal
Make AudiFiya’s mobile bottom dock and mini-player clearer and more transparent, closely following the uploaded reference while retaining AudiFiya’s three destinations and playback controls.

## Changes
- Refine the dock shell into a darker, highly translucent capsule with a subtle rim, inner highlight, and deeper floating shadow so page content remains visible through it.
- Restyle the active tab lens to match the reference’s refractive bubble: stronger curved-edge distortion, specular highlight, and soft magnification.
- Keep both tap navigation and the existing draggable spring lens, including elastic edge resistance and reduced-motion behavior.
- Apply the same transparent glass language to the mini-player so both floating layers feel like one system, while preserving artwork, track details, controls, progress, and swipe gestures.
- Preserve Standard mode unchanged; apply the new appearance only to Liquid Dark and Liquid Light with theme-appropriate contrast.
- Keep the existing fixed-height shell, safe-area spacing, and separation between the mini-player and dock.

## Technical details
- Reuse the existing React/Framer Motion interaction instead of copying the standalone JavaScript spring loop.
- Tune the shared glass tokens and SVG displacement/specular filter to reflect the uploaded implementation’s transparent track and convex lens.
- Retain a CSS frosted-glass fallback where SVG backdrop refraction is unsupported.
- Avoid the uploaded demo’s decorative background orbs and five-tab content; only its glass treatment and motion behavior will be adapted.

## Verification
- Check Home, Search, and Library navigation by both tap and drag.
- Check mini-player play/pause, next, like, expand, and swipe gestures.
- Visually verify Liquid Dark and Liquid Light on a short phone viewport, including safe-area spacing and readable contrast.
- Confirm reduced-motion and non-refraction fallbacks remain usable, with no runtime or build errors.
