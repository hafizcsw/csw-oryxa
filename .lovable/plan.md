
# Fix light-mode hero stars so they actually appear

## Root cause
The hero particle layer is present, but the current light-mode setup is too weak to read reliably:
- `HeroSection` mounts `AntigravityParticleField` without an explicit theme prop
- the particle field infers theme from `document.documentElement.classList.contains('dark')`
- in light mode it uses smaller particles and a blue tone that is still too faint
- blending is fixed to `THREE.AdditiveBlending`, which is tuned for dark backgrounds, not for a white hero

## What to change

### 1. Pass the resolved theme explicitly from the hero
In `src/components/home/HeroSection.tsx`:
- read `resolvedTheme` with `useTheme()`
- pass `theme={resolvedTheme === "dark" ? "dark" : "light"}` into `AntigravityParticleField`

This removes any mismatch between the actual site theme and the particle shader.

### 2. Strengthen the light-mode particle settings
In `src/components/home/hero-shader/antigravity/AntigravityParticleField.tsx`:
- keep dark mode unchanged
- make light mode visibly stronger by increasing:
  - particle color contrast
  - alpha multiplier
  - point size
  - size clamp
- use a darker, more readable blue for day mode instead of the current faint tone

Target adjustment:
- light color: deeper blue / navy family
- `uAlphaBoost`: increase clearly above current `5.0`
- `uSizeScale`: increase above current `0.55`
- `uSizeClamp`: allow larger visible points

### 3. Use theme-specific blending
In `AntigravityParticleField.tsx`:
- keep `THREE.AdditiveBlending` for dark mode
- switch light mode to a blending mode that reads on white, such as `THREE.NormalBlending`

This is the key visual fix so the stars do not disappear into the bright hero.

### 4. Optional light-mode canvas emphasis
If the stars are still too subtle after the shader change:
- add a light-mode-only canvas style enhancement on the particle container, such as slightly higher opacity or a subtle blend-mode treatment
- keep this scoped to the hero only

## Files to edit
- `src/components/home/HeroSection.tsx`
- `src/components/home/hero-shader/antigravity/AntigravityParticleField.tsx`

## Expected result
- In light mode, the hero stars are clearly visible without touching the hero layout
- In dark mode, the current appearance stays the same
- No map, no below-hero sections, and no homepage composition changes

## Done criteria
- light-mode hero visibly shows the particle field at normal desktop viewport
- dark-mode hero matches current behavior
- no hardcoded visible UI text introduced
- change is code-ready; runtime proof will require preview verification after implementation
