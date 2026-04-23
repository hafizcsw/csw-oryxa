# Phase A — Source-Side Normalization Engine

**Lane:** SEPARATE from Door 1/2/3. Door 1=CLOSED, Door 2=PARTIAL, Door 3=PARTIAL — all FROZEN.

## Scope (locked)

Build the *source-side* normalization layer that converts:

```
award/document truth (raw)  →  normalized credential truth
```

This is the foundation that Door 2/3 prototypes may *later* consume as
authoritative source of truth — that decision is **deferred** to the
Phase A exit decision point.

## Source countries (locked — 3 only)

- EG — Egypt
- AE — United Arab Emirates
- JO — Jordan

No other source country may be added during Phase A.

## Layers (10 total)

### Supabase tables (6) — created in migration

- `document_extraction_raw`
- `document_extraction_canonical`
- `document_evidence_flag`
- `student_award_raw`
- `student_credential_normalized`
- `credential_mapping_decision_log` (immutable audit trail)

### Local TypeScript packs (4) — reference data

- `country_education_profile` — `packs/country-profiles/`
- `credential_name_patterns` — `packs/credential-patterns/`
- `language_test_cefr_mapping` — `packs/language-cefr/`
- `credential_mapping_rule` — `packs/mapping-rules/`

Hybrid rationale: reference data evolves with engine logic; keeping it
co-located with the normalizer makes contract changes auditable in one
PR. Student-facing data (raw/canonical/normalized/log) lives in
Supabase under RLS.

## Engine status

| Component | Status |
|---|---|
| Types & contracts | code-ready |
| 4 reference packs (EG/AE/JO) | code-ready (data drafted, awaiting review) |
| Engine logic | NOT IMPLEMENTED — skeleton only |
| Golden Set 9/9 | proposed (awaiting truth review) |
| 4th-country data-only proof | NOT ATTEMPTED |

## Exit criteria (do not relax)

- [ ] migrations applied ✅
- [ ] source-side normalizer runs on EG, AE, JO
- [ ] 9/9 golden set cases pass with expected outputs
- [ ] 4th country added via data-only (no code edits to engine/types/registry)
- [ ] normalized output is shaped to be consumable as truth source for Door 2/3 *if* later wired

## Frozen — do NOT touch in Phase A

- Door 1 / Door 2 / Door 3 (any expansion)
- APUS / ISUS / CCUS full versions
- program graph, university matching, scholarships, visa, improvement engine
- DB persistence for Door 3 measurement snapshot
- new countries beyond EG/AE/JO

## Decision point (after Phase A only)

After 9/9 golden + 4th-country data-only proof:
decide reuse vs rebuild for wiring normalizer → Door 2/3.
Do NOT pre-decide.
