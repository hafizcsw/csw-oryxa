---
name: Phase A — Source-Side Normalization
description: Hybrid normalization layer (Supabase + local TS packs) for EG/AE/JO. Skeleton only, awaiting golden-set review.
type: feature
---

Phase A is a SEPARATE lane from Door 1/2/3 (which remain frozen).

**Scope (locked):**
- 3 source countries only: EG, AE, JO
- 6 Supabase tables (raw → canonical → flag → award_raw → normalized → decision_log)
- 4 local TS reference packs (country profiles, credential patterns, language CEFR, mapping rules)
- Engine = skeleton; golden set 9/9 = DRAFT

**Status:**
- migrations: applied
- types/contracts: code-ready
- packs: drafted (DRAFT evidence_ids)
- engine logic: NOT implemented (returns "unknown" + manual review)
- golden set: proposed, awaiting truth review

**Exit criteria** (see `src/features/source-normalization/PHASE_A_STATUS.md`):
1. 9/9 golden cases pass
2. 4th country addable via data-only (no code edits to engine/types/registry)
3. normalized output shape consumable as truth source for Door 2/3 *if* later wired

**Frozen — do NOT touch in Phase A:**
Door 1/2/3, APUS/ISUS/CCUS full, program graph, university matching, scholarships, visa, improvement engine, Door 3 snapshot persistence, any country beyond EG/AE/JO.

**Decision point** (after exit criteria only): reuse vs rebuild for wiring normalizer → Door 2/3.
