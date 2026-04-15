# STUDENT_FILE_FREEZE.md — Canonical Student File Governance

## Status: ✅ FROZEN (Door 1 closed)

## Scope
This freeze applies to the Canonical Student File model and its governance rules.

## What This Door Established
1. **Single truth model**: `CanonicalStudentFile` in `canonical-model.ts`
2. **Provenance layer**: Every field has `source_type`, `field_state`, `verified_status`
3. **CRM adapter**: `crm-adapter.ts` maps existing `StudentPortalProfile` → canonical shape
4. **Field origin registry**: Documents canonical owner, CRM source, compat path, deprecation plan

## Freeze Rules (Non-Negotiable)
1. **No localStorage truth** in any real lane (ReadinessTab localStorage is acknowledged as LEGACY DRIFT — marked for future migration but NOT touched in this door)
2. **No Portal truth vs CRM truth** — one canonical model
3. **No AI-independent truth** writes
4. **No direct UI→canonical truth** writes without adapter
5. **No premature surface deletion** before replacement exists
6. **No CRM sync** logic changes in this door
7. **No OCR / document parsing / decision engine / report engine**

## Known Legacy Drift (Untouched — Do Not Break)
| Location | Issue | Status |
|----------|-------|--------|
| `ReadinessTab` → `localStorage('csw_readiness_profile')` | Local-only truth for readiness form | ⚠️ LEGACY — planned migration in future door |
| `ReadinessTab` → `localStorage('csw_readiness_target_requirements')` | Local-only target requirements | ⚠️ LEGACY — planned migration in future door |
| `StudentProfile` (legacy interface) | Mapped from CRM via `mapToLegacyProfile()` | ⚠️ COMPAT — kept for existing components |
| `ProfileTab` form state | Merges CRM into local React state for editing | ✅ OK — editing pattern, not truth storage |
| `calculateProfileProgress()` | Reads `StudentPortalProfile` directly | ⚠️ COMPAT — should read canonical in future |

## Canonical Fields Registry
See `FIELD_ORIGIN_MAP` in `crm-adapter.ts` for the complete mapping of:
- Canonical owner
- CRM source field
- Temporary compatibility path
- Planned deprecation trigger

## What Remains Open (By Design)
- [ ] Door 2: OCR/extraction pipeline
- [ ] Door 3: Eligibility/decision engine
- [ ] Door 4: Report engine
- [ ] Door 5: CRM sync (canonical → CRM writeback)
- [ ] Door 6: ReadinessTab migration from localStorage to canonical
- [ ] Door 7: Legacy `StudentProfile` interface deprecation

## Frozen Files
| File | Status |
|------|--------|
| `src/features/student-file/canonical-model.ts` | 🔒 FROZEN |
| `src/features/student-file/crm-adapter.ts` | 🔒 FROZEN |
| `src/features/student-file/STUDENT_FILE_FREEZE.md` | 🔒 FROZEN |

## Surface Integrity Proof
- No existing component imports were changed
- No existing hook signatures were modified
- No existing data flow was altered
- `StudentPortalProfile` remains the runtime source via CRM edge function
- `CanonicalStudentFile` is additive — zero breaking changes

## Closure Criteria (All Met ✅)
- [x] Clear where local student file truth lives → `CanonicalStudentFile`
- [x] Approved fields defined → 4 blocks, 35 fields
- [x] Field state documented → `FieldState` enum per field
- [x] Value origin tracked → `FieldProvenance` with `source_type`
- [x] What is no longer allowed to be truth → localStorage, parallel truth stores
- [x] Existing surfaces unbroken → zero import/signature changes
