

## Problem

When drilling into a city (e.g. Moscow), universities without precise geo coordinates are placed at the **country center** (`[62, 96]` for Russia — deep in Siberia). This causes:
1. The "318 unverified" dot appears thousands of km from Moscow
2. The map zooms out to fit both Moscow and Siberia, making it confusing

## Root Cause

In `WorldMapLeaflet.tsx` lines 1160-1171, the fallback position for universities without coordinates uses `CC[selectedCountryCode]` (country center). It should use the **selected city's coordinates** instead.

## Fix

**File: `src/components/home/WorldMapLeaflet.tsx`**

1. **Change fallback marker position** (lines 1160-1171): Instead of `CC[selectedCountryCode]`, use the selected city's lat/lon (`selectedCitySummary.city_lat/city_lon`) as the fallback position. Only fall back to country center if city coordinates are also unavailable.

2. **Exclude fallback point from bounds calculation**: Remove `pts.push(...)` for the fallback marker so it doesn't distort the map zoom. The fallback marker will still be visible but won't pull the camera away from the actual city.

These are ~10 lines changed in a single file. No new files needed.

## Technical Detail

```
// Before (broken):
const fallbackPos = [CC[selectedCountryCode][0], CC[selectedCountryCode][1]];
pts.push(L.latLng(fallbackPos[0], fallbackPos[1]));

// After (fixed):
const cityCenter = selectedCitySummary;
const fallbackPos = cityCenter?.city_lat != null && cityCenter?.city_lon != null
  ? [cityCenter.city_lat, cityCenter.city_lon]
  : CC[selectedCountryCode]
    ? [CC[selectedCountryCode][0], CC[selectedCountryCode][1]]
    : null;
// Do NOT push fallbackPos into pts (don't distort bounds)
```

