

## Goal
Hover over a country on the big map → 3D sidebar globe rotates instantly to that country. Moving across countries updates live. Click/selection behavior unchanged. Hover is transient preview only.

## Constraints applied
- Hover signal = **country code only**, not polygon bounds center.
- Globe resolves country code → coordinates internally (it already does this for selection).
- Small delayed clear on `mouseout` (~80 ms), cancelled by next `mouseover` → no flicker between adjacent countries.
- Hover never touches drill level, never touches selected country, never triggers refetch.

## Changes

### 1. `src/components/home/WorldMapLeaflet.tsx`
- Add optional prop: `onCountryHover?: (code: string | null) => void`.
- In the existing per-country `layer.on({ mouseover, mouseout })` block:
  - `mouseover`: `onCountryHover?.(code)` (alongside existing fill style change).
  - `mouseout`: `onCountryHover?.(null)` (alongside existing reset).
- No bounds math, no city hover, no other changes.

### 2. `src/components/home/WorldMapSection.tsx`
- Add state: `const [hoveredCountryCode, setHoveredCountryCode] = useState<string | null>(null)`.
- Add a `useRef<number | null>(null)` for a delayed-clear timer.
- Handler passed to map:
  ```ts
  const handleCountryHover = (code: string | null) => {
    if (code) {
      if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = null; }
      setHoveredCountryCode(code);
    } else {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setHoveredCountryCode(null), 80);
    }
  };
  ```
- Cleanup timer on unmount.
- Pass `onCountryHover={handleCountryHover}` to `<WorldMapLeaflet>`.

### 3. Feed globe (same file, ~lines 984–1000)
- Change to: `focusCountryCode={hoveredCountryCode ?? selectedCountryCode}`.
- Drop the previously-planned `hoveredLatLon`. Globe resolves coords from the country code via its existing lookup path (same one used for selection today).
- `focusLatLon` keeps current selection-based value (unchanged), used only when no hovered country and a city is selected.

### 4. `Globe3D.tsx`
- No logic change. It already reacts to `focusCountryCode` changes via its `useEffect` + LERP rotation. Hover just feeds it a different code more often.

## Why this satisfies every constraint
- **Live hover preview**: state flips on `mouseover` synchronously → globe `useEffect` fires same tick → smooth LERP starts immediately.
- **No flicker**: 80 ms delayed clear is cancelled the moment the cursor enters the next country polygon, so the globe never sees a `null` between adjacent countries.
- **Selection untouched**: `selectedCountryCode`, drill level, and city selection are never written by hover code paths.
- **Narrow scope**: only country-level hover; no city hover, no new deps, no bounds geometry, no refetches.
- **Reliability**: country code is a stable, single-value signal — no issues with multi-part countries (US, Russia, France) that bounds-center would mishandle.

## Files touched
1. `src/components/home/WorldMapLeaflet.tsx` — add prop + 2 lines in existing handlers.
2. `src/components/home/WorldMapSection.tsx` — hover state, delayed-clear handler, globe prop swap.

## Out of scope
City hover, globe internals, map styling, caching, drill logic, selection logic.

