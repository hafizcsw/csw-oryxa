# Project Memory

## Core
Canonical repo is hafizcsw/csw-world.
Canonical Supabase is pkivavsxbvwtnkgxaufa.
Do not use Lovable Cloud, old Cloud backends, new GitHub repos, or parallel projects as source of truth.
Program Intelligence lane is FROZEN — no expansion unless it blocks Student File Quality + Fit.
Door 1 (Canonical Student File) is CLOSED — do not re-expand.
Door 2 (Document Registry + Upload Hub) is NEAR-CLOSE — do not reopen.
Door 3 (Document Understanding + Proposals) is OPEN — internal parsers, extraction, proposal lifecycle, truth promotion.
Target-country lane: Door 1 CLOSED, Door 2 PARTIAL, Door 3 PARTIAL — see truth status memory; do NOT call TR a "data-only proof".
Phase A (Source-Side Normalization) is the active lane: EG/AE/JO only, skeleton + golden-set DRAFT. Door 1/2/3 frozen.

## Memories
- [Canonical foundation](mem://constraints/canonical-foundation) — Allowed repo/backend model and forbidden parallel paths
- [Program Intelligence freeze](mem://constraints/program-intelligence-freeze) — Lane closed, explicit tech debt recorded
- [Canonical Student File](mem://features/canonical-student-file) — Door 1 CLOSED. Runtime hook + visible consumer + AccountContentHeader canonical-first name. Phone NOT canonical-first.
- [Door 3 analysis](mem://features/door3-document-analysis) — Internal document understanding: PDF text + MRZ + regex. Proposal lifecycle with auto-accept/pending/reject. No external LLM.
- [Door 4 transcript lane](mem://features/door4-transcript-lane) — Order 2: structured partial transcript parser, intermediate non-canonical rows, multi-signal disambiguation, HONESTY GATE 3 (review-first only)
- [Target-country truth status](mem://constraints/target-country-truth-status) — Target-country lane Door 1 CLOSED, Door 2 PARTIAL (no live target-student loader), Door 3 PARTIAL (cannot close before Door 2), TR not data-only
- [Phase A source normalization](mem://features/phase-a-source-normalization) — Active lane. 6 Supabase tables + 4 local TS packs. EG/AE/JO. Skeleton engine + DRAFT golden set 9/9. Door 1/2/3 frozen.
