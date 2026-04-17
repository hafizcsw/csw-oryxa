

## Goal
Keep the brain at small size (no growing). While files are being scanned, the brain itself "fills up" technically from inside — like the reference image: glowing neural circuits, binary streams, and an inner AI chip light up progressively as scanning advances. Each active scan beam on a card visually feeds into the brain, drawing more circuitry inside it in real time.

## Visual concept (from reference image)
- Brain silhouette stays the same small size.
- Inside the brain: layered tech imagery appears progressively:
  1. **Neural circuit lines** — thin cyan/blue lines tracing through the brain's interior, drawn with `stroke-dasharray` animation.
  2. **Inner AI chip** — small glowing square at brain center (like the "AI" chip in the reference) that pulses brighter as more files complete.
  3. **Binary rain** — faint `1`/`0` characters flowing downward inside the brain mask.
  4. **Synapse dots** — small glowing nodes that light up along the circuit paths.
- Fill progress is bound to: `(done files) / (total files)`. So as each file flips to `done`, more of the inner tech imagery becomes visible/illuminated.
- While any file is `active`, the inner circuits pulse/animate continuously (energy flowing).

## Exploration needed
1. `src/components/documents/AIDataFlowHero.tsx` — locate the brain SVG element, the current `shrink` scale logic, and where to inject the inner tech layer (must be clipped to brain shape).
2. Confirm the brain is rendered as an SVG `<path>` (so we can reuse it as a `<clipPath>`) or as an `<image>`. If it's an image, we'll need a brain-shaped `<clipPath>` (an approximate path) to mask the inner tech overlay.

## Design

### 1. Remove brain shrink behavior
- Drop the `shrink` scale animation. Brain stays at its current "small" size permanently.
- Remove the `anyInFlight ? 0.5 : 1` scale logic.

### 2. Add inner tech layer (clipped to brain)
New SVG group `<g clip-path="url(#brain-clip)">` placed on top of the brain image, containing:

**a. Circuit grid** — ~12-16 thin polylines forming a stylized neural/circuit pattern across the brain interior. Each line has `stroke-dasharray` + animated `stroke-dashoffset` to "draw in" progressively.

**b. Inner chip** — a small rounded rect at brain center with "AI" text, glowing cyan. Opacity tied to progress.

**c. Binary stream** — a vertical column of `0`/`1` SVG `<text>` elements with a downward translate animation, low opacity.

**d. Synapse nodes** — ~8 small `<circle>` elements at circuit intersections that fade in one-by-one as progress increases.

### 3. Bind to real progress
```ts
const total = files.length;
const doneCount = files.filter(f => f.status === 'done' || f.status === 'failed').length;
const activeCount = files.filter(f => f.status === 'active').length;
const fillProgress = total > 0 ? doneCount / total : 0; // 0..1
const isEnergized = activeCount > 0; // pulse animations on/off
```

- Circuit lines: each line's `pathLength` reveal is gated by `fillProgress` (e.g., line N visible when `fillProgress >= N/totalLines`).
- Inner chip glow opacity: `0.3 + 0.7 * fillProgress`.
- Binary rain + synapse pulse: only animate while `isEnergized` is true.
- When all done: full circuitry visible, gentle steady glow (no pulse).

### 4. Connector beams now "feed" the brain
- Existing connectors from active cards already converge on brain center. Keep them; they visually become the energy source filling the inner circuitry.
- Add a subtle radial glow at brain center that intensifies with `activeCount`.

### 5. Brain clip path
- If brain is an `<image>`: define a `<clipPath id="brain-clip">` with an approximate brain silhouette `<path>` matching the image's outline. All inner tech draws into this clip so it never spills outside.
- If brain is already a `<path>`: reuse its `d` attribute inside the clipPath.

## Files to change
- `src/components/documents/AIDataFlowHero.tsx` — only file. Remove shrink logic, add `<defs>` with brain clipPath + gradients, add inner tech `<g>` overlay bound to `fillProgress` and `isEnergized`.

## Verification
- Brain stays small, never grows or shrinks.
- Upload 1 file → inner circuits start drawing in + chip glows + binary rain flows while card is `active`. When card flips to `done`, brain shows ~100% filled circuitry with steady glow.
- Upload 5 files → circuitry fills in 5 stages (20%, 40%, 60%, 80%, 100%) as each completes. Pulse animation runs whenever any card is still `active`.
- No layout shift; no card changes; only brain interior gains the new tech imagery.

