---
name: target-country lane truth status
description: Target-country lane (after-secondary engine) — Door 1 CLOSED, Door 2 PARTIAL, Door 3 PARTIAL. Live target-student runtime not authoritative. TR is NOT data-only.
type: constraint
---
Target-country lane (separate from document-pipeline lane) status:

- Door 1 (Canonical Student File) = CLOSED.
- Door 2 (10-country eligibility engine) = PARTIAL.
  Reason: live smoke on a real target student from admin context is not
  authoritative. No admin-side CRM proxy exists to load a target student's
  truth by target_user_id. The "Target student" tab in /admin/target-country
  accepts pasted ApplicantTruth JSON — this is engine input forwarding,
  NOT runtime closure.
- Door 3 (measurement-lite + harness + extensibility) = PARTIAL.
  Reason: cannot close before Door 2. Measurement-lite is code-ready,
  harness is runtime-proven on fixture only.

TR (Türkiye) extensibility correction:
- TR pack file is data-only.
- BUT types.ts CountryCode union AND packs/index.ts registry both required
  code edits. Therefore TR is NOT a "data-only proof". Do not use that phrase.

Source of truth: src/features/target-country/TRUTH_STATUS.md.
Frozen for this lane: APUS/ISUS/CCUS full, snapshot persistence, program graph,
university matching, scholarships, visa, improvement engine.
