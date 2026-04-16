

## Approved narrow patch — implementation plan

### 1. `package.json` — heap bump only
Prefix `build:dev` (and `build` if identical OOM) with `NODE_OPTIONS=--max-old-space-size=4096`. No other script changes.

### 2. `src/components/home/WorldMapSection.tsx` — stabilize boundary callbacks
Wrap these in `useCallback` with correct deps before passing to `<WorldMapLeaflet>`:
- `onCountrySelect`
- `onRegionSelect`
- `onCitySelect`
- `onBackToCountry`
- `onBackToWorld`

No other changes in this file.

### 3. `src/components/home/WorldMapLeaflet.tsx` — callbacksRef + deps trim + animation tuning

**callbacksRef pattern:**
- Add `const callbacksRef = useRef({ onCountrySelect, onRegionSelect, onCitySelect })`.
- Tiny `useEffect` syncs it each render.
- Replace direct `onCountrySelect(...)` / `onRegionSelect(...)` / `onCitySelect(...)` calls inside the giant effect with `callbacksRef.current.X(...)`.

**Deps array (giant effect, ~line 1640) — remove ONLY:**
- `onCountrySelect`
- `onRegionSelect`
- `onCitySelect`

**Keep unchanged:** `mapText`, `getLocalizedValue`, `language`, `isDark`, `isRtl`, `countryMeta`, `osmOverlay`, `worldGeo`, `drillLevel`, `countryStats`, `visibleCountryCodes`, `citySummaries`, `cityUniversities`, `regionCities`, `regionSummaries`, `selectedCountryCode`.

**Animation tuning (conservative):**
- `flyTo` (~line 1629): `{ duration: 0.65, easeLinearity: 0.35 }`
- `flyTo` (~line 1633): `{ duration: 0.65, easeLinearity: 0.35 }`
- `fitBounds` (~line 1631): `{ animate: true, duration: 0.55, easeLinearity: 0.35, maxZoom: 12 }`
- `flyTo` search-highlight (~line 584): `{ duration: 0.7, easeLinearity: 0.35 }`

## Out of scope (not touched)
Globe3D architecture, lazy-loading WorldMapLeaflet, splitting the giant effect, hover/globe sync, tooltip HTML generation, drill/back logic, GeoJSON/caching flow, any other deps.

## Files edited
1. `package.json`
2. `src/components/home/WorldMapSection.tsx`
3. `src/components/home/WorldMapLeaflet.tsx`

## Proof obligations
- Build succeeds with heap bump.
- Country→country zoom transitions feel ~650ms, smooth, no white flash, borders + markers persist.
- Language switch (EN↔AR): tooltips render translated text on next hover.
- Theme switch: borders recolor.
- Drill / back behavior unchanged.

