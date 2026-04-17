

## Goal
Sequential, realistic per-file scanning. Only ONE file is actively being scanned at a time. When its scan completes, the brain stops pulling from it (connectors/chips fade off for that card, scan beam disappears, card shows a "scanned" state), then the next card becomes active. Each card displays its real source filename as a title.

## Exploration Needed
Read `src/components/documents/AIDataFlowHero.tsx` to confirm:
- How `fileCount` / files are passed in (do we have actual filenames or just a count?).
- Current `DocumentCard` props (need to add `label` + `isActive` + `isDone`).
- Where `connectors` and `DocumentChip` are rendered (need to gate them per-card by active state).
- Parent component (study-file tab) that owns the upload state — to pass real filenames down.

## Design

### 1. Real filenames
- Change the hero's API from `fileCount: number` to `files: { name: string }[]` (keep `fileCount` derived as fallback for backward compat).
- Parent (study-file upload area) passes the actual `File[]` (or `{name}[]`) into the hero.
- Each `DocumentCard` receives `label` and renders it as a small title strip at the top of the card (truncated, max ~14 chars + ellipsis), replacing the generic header bar text.

### 2. Sequential scan state machine
Inside `AIDataFlowHero`:
- New state `activeIndex: number` (0 → totalDocs-1, then "all done").
- Each card has a global index `gIdx` (matches `files[gIdx]`). Order = left column top→bottom, then right column top→bottom (deterministic, matches visual reading order).
- A timer (`useEffect` with `setTimeout`) advances `activeIndex` every `SCAN_DURATION_MS` (e.g. 2600ms per file).
- When `files` array changes (new file added), keep `activeIndex` where it is if still valid; if all were done and new files arrive, resume from the first not-yet-done index.
- Track `doneSet: Set<number>` of completed indices.

### 3. Per-card visual states
`DocumentCard` gets `state: 'pending' | 'active' | 'done'`:
- **pending**: card visible in slot, dim (opacity 0.55), no scan beam, no shimmer on body lines, body lines static gray.
- **active**: full opacity, scan beam sweeping, body lines shimmer (current live behavior), small "Scanning…" micro-label or pulsing dot near the title.
- **done**: full opacity, scan beam hidden, body lines static but tinted success-green, a small ✓ check badge in the corner.

### 4. Per-card connectors + chips gating
Currently `connectors` is one flat memo for all cards. Refactor so connectors and chips are filtered to render only for the card whose `gIdx === activeIndex`:
- Connectors for inactive/done cards → not rendered (or rendered with opacity 0, instant).
- Chips only flow on the active card's 3 lines.
- Result: at any moment only ONE card has lines + chips going to the brain — exactly the "brain is reading this file right now" feel.

### 5. Brain reaction
- Brain stays at 0.5 scale while any card is `active` or `pending`.
- Optional: subtle pulse intensity tied to active scanning (already breathing — keep as is).
- When all cards are `done`, brain returns to scale 1 after a short delay.

### 6. Timing
- `SCAN_DURATION_MS = 2600` (matches roughly the existing scan-beam sweep duration).
- Scan beam animation duration synced to `SCAN_DURATION_MS` so the beam reaches the bottom exactly when the file is marked done.
- Small 200ms gap between files for a clean handoff.

### 7. i18n
- "Scanning…" and "Scanned" micro-labels go through `t('hero.aiFlow.scanning')` / `t('hero.aiFlow.scanned')` — added to all 12 locale files (or at minimum en/ar with safe key fallback).

## Files to change
- `src/components/documents/AIDataFlowHero.tsx` — add `files` prop, sequential scan state machine, per-card `state`, per-card connector/chip gating, filename label, done check badge.
- Parent that mounts `AIDataFlowHero` on the study-file tab — pass real `files` array (need to locate via search; likely a component under `src/features/.../study-file/` or the documents area).
- Locale files — add 2 keys (`hero.aiFlow.scanning`, `hero.aiFlow.scanned`) across the 12 locales.

## Verification
- Upload 1 file → card shows filename, scans once, marks done, brain returns to full size.
- Upload 5 files → cards appear; only the 1st has connectors + chips; after ~2.6s it's checkmarked, connectors switch to the 2nd card; continues sequentially through all 5; brain returns to full size after the 5th.
- Add a 6th file mid-sequence → it appears as `pending`, gets scanned in turn.
- Each card's title shows the real uploaded filename, truncated.

