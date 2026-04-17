

## Problem
The scan animation runs on its own fixed timer (2600ms per file) and is NOT tied to the real backend processing state of each file. So the engine may still be parsing a file while the UI already marked it "done", or vice versa — the visual scan and the real work are out of sync.

## Goal
Bind each `DocumentCard`'s state (`pending` / `active` / `done`) to the **actual processing status of that specific document record**, not to a `setTimeout`.

## Exploration Needed
1. `src/components/documents/CentralUploadHub.tsx` — see what document records it holds, what status field exists (`status`, `processing_status`, `parsed_at`, etc.), and how it currently passes `files` to `AIDataFlowHero`.
2. `src/components/documents/AIDataFlowHero.tsx` — current `activeIndex` timer logic to remove.
3. The documents table schema / hook that feeds CentralUploadHub — confirm the real status enum values (e.g. `uploading` → `processing` → `processed` / `failed`).

## Design

### 1. Pass real status per file
Change the hero's `files` prop from `{ name: string }[]` to:
```ts
files: { name: string; status: 'pending' | 'active' | 'done' | 'failed' }[]
```
`CentralUploadHub` maps each document record's real status to one of these 4 values:
- not yet started / queued → `pending`
- currently being parsed / extracted → `active`
- finished successfully → `done`
- error → `failed` (treated visually like `done` but with a red tint, optional)

### 2. Drop the timer in AIDataFlowHero
- Remove `activeIndex` state, `SCAN_DURATION_MS` advancement, and the `useEffect` setTimeout loop.
- `DocumentCard.state` now comes directly from `files[gIdx].status`.
- `activeConnectors` / `DocumentChip` rendering is gated by "is this card's status === 'active'" — multiple cards CAN be active simultaneously if backend processes in parallel (matches reality).

### 3. Brain reaction
- Brain stays at 0.5 scale while ANY file has status `pending` or `active`.
- Returns to 1.0 only when every file is `done` (or `failed`).

### 4. Scan beam timing
- Scan beam loops continuously (2.6s sweep) while card is `active`. It no longer needs to "finish" at a specific moment — it just keeps sweeping until the real status flips to `done`, then disappears and the green ✓ appears.

### 5. Source of truth in CentralUploadHub
Locate the documents query/hook and derive status:
```ts
const heroFiles = documents.map(d => ({
  name: d.original_file_name,
  status: deriveStatus(d), // reads d.status / d.parsed_at / d.processing_state
}));
```
If the backend currently has only a binary "uploaded vs not", we'll need to also surface a "processing" flag — exploration of the documents hook will confirm what's already available. If nothing exists, fallback: treat freshly inserted rows (< N seconds old, no `parsed_at`) as `active`, rows with `parsed_at` as `done`.

## Files to change
- `src/components/documents/AIDataFlowHero.tsx` — extend `files` prop with `status`, remove timer state machine, drive card state from prop.
- `src/components/documents/CentralUploadHub.tsx` — map real document records → `{name, status}` and pass down.
- (Possibly) the documents hook/query file — only to read existing status fields, no schema changes unless exploration shows none exist.

## Verification
- Upload 1 file → card is `active` (beam sweeping) for as long as backend is parsing; flips to `done` ✓ exactly when parsing finishes.
- Upload 5 files at once → if backend processes them in parallel, multiple cards show `active` simultaneously, each flipping to `done` independently as their real processing finishes.
- Brain returns to full size only after the LAST file actually finishes processing on the backend.

