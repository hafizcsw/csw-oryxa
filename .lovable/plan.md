

## Live Profile Assembly — Final Plan (v4, approved with 3 fixes)

Same as v3, with three mandatory amendments.

### Fix 1 — Separate reading route from destination lane

Two distinct concepts, never conflated:

- **reading_route** (from artifact `chosen_route`): `born_digital_pdf` | `scanned_pdf` | `image` | `unsupported`. Shown in `DocAssemblyHeader` as a diagnostic, labeled with key `portal.assembly.header.reading_route`.
- **destination_lane** (UI assignment): `identity` | `academic` | `language` | `needs_review`. Shown separately, labeled with key `portal.assembly.header.lane`.

Header strip order:
1. destination_lane
2. reading_route (artifact `chosen_route`)
3. parser_used (artifact)
4. classification + confidence (analysis)
5. readability (analysis)
6. failure_reason (artifact, if any)
7. parser_type (analysis, secondary/dim, only when differs from parser_used)

If artifact lacks `chosen_route` or `parser_used`, render "—". No fabrication.

### Fix 2 — Lane assignment requires resolved classification

Routing is only applied when classification is actually resolved AND confidence is sufficient:

- `passport` (resolved) → Identity
- `transcript` (resolved) → Academic
- `graduation_certificate` (resolved) → Academic
- `language_certificate` (resolved) → Language
- `unknown` / `other` / classification_uncertain / low confidence / no classification → **Needs review** zone (NOT Identity/Academic/Language)

Unreadable docs:
- If classification IS resolved despite unreadability → drop to the resolved lane, render template fields as unresolved with the doc-level failure_reason.
- If classification is NOT resolved → drop to **Needs review**, NOT to a content lane.

The Needs review zone is a real visible region above the 3 lanes. Chips land there with a visible reason chip (e.g. "classification_uncertain", "low_confidence", "unreadable + unclassified").

### Fix 3 — Hook must expose artifacts/hydrated surfaces as state

`LiveProfileAssembly` reads artifact truth from state, not console. If `useDocumentAnalysis` does not already expose `artifacts` and `hydratedArtifactSurfaces` as returned state, edit it.

Updated edited-files list:
- `src/hooks/useDocumentAnalysis.ts` — ensure `artifacts` (live, per-doc) and `hydratedArtifactSurfaces` (reload-safe) are part of the returned API. If already exposed, no change. Verified during implementation by reading the hook first.
- `src/components/portal/tabs/StudyFileTab.tsx`
- `src/components/documents/CentralUploadHub.tsx` (single `onPreviewsReady` callback only)
- 12 locale files

### Fix 4 — Accepted status reflects actual proposal/promoted state only, never template

The UI MUST NOT assume acceptance for any field based on template membership. Specifically:

- Language fields are NOT pre-marked accepted just because Door 3 has a narrow auto-accept whitelist for `english_test_type` and `english_total_score`.
- A field is rendered **accepted** ONLY when one of these is true at runtime:
  - the proposal exists with `proposal_status === 'auto_accepted'`, OR
  - the field key is present in `promotedFields`
- Otherwise: pending (proposal `pending_review`), unresolved (proposal `rejected` or no proposal for an expected template field), or empty for academic (extraction-driven).

No optimistic acceptance. No template-driven status. Status is always derived from live state.

### Everything else from v3 stands

- Identity + Language fixed deterministic templates; Academic extraction-driven
- Deterministic field order arrays in `assembly-field-templates.ts`
- Transcript: first 6 subject rows animated + "+N more" summary
- Academic honesty footer = 3 metric pills (extracted / missing / subject_rows) via translation keys
- Animation sequence: queued → dropping → lane_pulse → chip_pinned → header_reveal → fields_reveal → settled
- Hydrated docs render in settled state, no animation
- All visible strings via `t()` keys under `portal.assembly.*` across 12 locales
- No changes to orb, upload hub visuals, analysis engine, proposals, promotion rules, persistence

### Files

**New**
- `src/components/documents/LiveProfileAssembly.tsx`
- `src/components/documents/AssemblyLane.tsx`
- `src/components/documents/AssemblyFieldRow.tsx`
- `src/components/documents/AssemblyDocChip.tsx`
- `src/components/documents/DocAssemblyHeader.tsx`
- `src/features/documents/assembly-field-templates.ts`

**Edited**
- `src/hooks/useDocumentAnalysis.ts` (only if artifacts/hydrated surfaces are not already in returned API)
- `src/components/portal/tabs/StudyFileTab.tsx`
- `src/components/documents/CentralUploadHub.tsx`
- 12 locale files (`portal.assembly.*` including `header.lane`, `header.reading_route`, `needs_review.*`, metric keys)

### Acceptance proof on the surface

- Passport (resolved) drop → Identity lane, header shows lane=identity AND reading_route=scanned_pdf|born_digital_pdf separately, 8 fields in fixed order; accepted ONLY where proposal/promoted state confirms it.
- Graduation cert drop → Academic lane, footer shows 3 metric pills with real counts.
- Transcript drop → Academic lane, base fields + capped 6 subject rows + "+N more".
- Language cert drop → Language lane, 8 fixed fields; `english_test_type` / `english_total_score` shown as accepted ONLY if proposals confirm — never by template.
- Unreadable + unclassified doc → drops to **Needs review**, not to a content lane.
- Unreadable + classified doc → drops to its lane, all template fields unresolved with visible doc-level failure_reason.

