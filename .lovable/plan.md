

## Problem
Uploading 5 files: connectors + chips render on both sides (proving `leftCards`/`rightCards` arrays are correct), but only 1 document card is visible on screen. The other 4 cards exist in the DOM but aren't visually placed.

## Root Cause
In `DocumentCard` (AIDataFlowHero.tsx, lines 581-597), the entrance animation uses framer-motion to animate a `transform` *string attribute* on a `<motion.g>`:

```
initial={{ transform: emergeFromTransform, opacity: 0 }}
animate={{ transform: settledTransform, opacity, y: [...] }}
```

Framer Motion does NOT reliably animate the SVG `transform` *attribute* as an interpolated string. It treats `transform` as a CSS transform, which for SVG `<g>` elements behaves inconsistently across browsers — and the simultaneous `y: [0, -2.2, 0, 2.2, 0]` keyframe (CSS y) conflicts with the SVG `y` attribute. The result: cards collapse to origin (0,0) or to a single position, so only the one whose final position happens to land in the visible area shows up.

The connectors don't have this bug because they're plain `<motion.path d="...">` with a `pathLength` animation — no per-card transform is needed.

## Fix
Refactor `DocumentCard` so positioning uses a static SVG `transform` attribute on the outer `<g>`, and the entrance animation uses motion-safe properties on an inner element:

1. **Outer `<g>`**: static `transform={settledTransform}` and `opacity` — this guarantees every card is placed in its correct (x, y, rotate, scale) slot, exactly like the working static fallback path on line 578.
2. **Inner `<motion.g>`**: handle entrance using `initial={{ scale: 0.2, opacity: 0, x: emergeDX, y: emergeDY }}` → `animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}`, where `emergeDX/DY` are computed in the card's local coordinate space (origin at center) so the card visually flies in from the user/bottom-center toward its slot.
3. **Idle float**: a separate inner `<motion.g>` (or a chained second animation) handles the gentle `y: [0,-2.2,0,2.2,0]` loop after the entrance completes (`delay: emergeDelay + 0.9`).
4. Keep all other props/visuals identical.

Also keep the dynamic `key={\`L-${i}-of-${totalDocs}\`}` so cards re-mount and re-emerge when `fileCount` changes.

## Verification
- Upload 1 file → 1 card on left, emerging from bottom-center.
- Upload 5 files → 3 cards left column, 2 cards right column, all visible, each with its own connector lines + chips flowing into the brain.
- Upload 2, then 5 → newly added cards animate in; existing cards stay put.

## Files
- `src/components/documents/AIDataFlowHero.tsx` — refactor `DocumentCard` motion structure only. No prop/API changes, no parent changes.

