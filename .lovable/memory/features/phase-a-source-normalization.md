---
name: Phase A — Source-Side Normalization
description: Persistence path CLOSED (live read_query proof). Phase A overall PARTIAL — atomic, duplication, 4th-country still open.
type: feature
---

Phase A is a SEPARATE lane from Door 1/2/3 (which remain frozen).

**Scope (locked):**
- 3 source countries only: EG, AE, JO
- 6 Supabase tables (raw → canonical → flag → award_raw → normalized → decision_log)
- 4 local TS reference packs (country profiles, credential patterns, language CEFR, mapping rules)

**Truthful status (do NOT widen):**
- **Persistence path = CLOSED** — live `read_query` proof on `student_award_raw`, `student_credential_normalized`, `credential_mapping_decision_log`, `student_evaluation_snapshots` (10/10/10/1 rows for live session, single snapshot updated on doc add).
- **Phase A overall = PARTIAL** — these remain open:
  1. write path is NOT a real atomic transaction (sequential best-effort writes from edge function)
  2. engine duplication between `src/features/source-normalization/*` and inline mirror in `phase-a-normalize` edge function
  3. 4th-country data-only proof not executed

**Never claim:**
- "Phase A CLOSED" (only persistence path is)
- "atomic writes" (until a real DB transaction is wired)
- "runtime-proven end-to-end" beyond persistence path

**Frozen — do NOT touch in Phase A:**
Door 1/2/3, APUS/ISUS/CCUS full, program graph, university matching, scholarships, visa, improvement engine, Door 3 snapshot persistence, any country beyond EG/AE/JO.

**Decision point:** deferred until atomic + duplication + 4th-country items close.
