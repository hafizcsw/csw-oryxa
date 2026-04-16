---
name: Door 4 — Transcript Lane (Order 2)
description: Order 2 transcript overhaul. Structured partial parser with intermediate (non-canonical) rows, multi-signal disambiguation, HONESTY GATE 3 (transcript proposals are review-first only)
type: feature
---

## Scope (locked)
- Structured transcript parser with truthful partial extraction
- Review-first only — no auto-accept on transcripts in V1
- Strict transcript vs graduation separation (multi-signal, NOT tabular-only)
- NO canonical schema change — rows live in `TranscriptIntermediate` (analysis layer)
- `graduation_date` is NOT a primary target; only header fields matter:
  institution, degree/program, GPA/CGPA, scale, rows/credits, grading hints

## Files
- `src/features/documents/parsers/transcript-structure.ts` — `TranscriptIntermediate`, rows, coverage, signals (analysis-layer only)
- `src/features/documents/parsers/transcript-parser.ts` — `parseTranscript()` + `computeTranscriptSignals()`
- `src/features/documents/parsers/content-classifier.ts` — multi-signal transcript disambiguation, `transcript_lane_strength`
- `src/features/documents/extraction-proposal-model.ts` — HONESTY GATE 3: `source_lane === 'transcript'` → forced `pending_review`
- `src/features/documents/analysis-engine.ts` — wires parser, passes `source_lane`, emits `[Order2:TranscriptLane]` log
- `scripts/order2-transcript-harness.mts` — deterministic Cases A + B

## Disambiguation signal basket (transcript_evidence score)
- vocabulary hits ×2 (transcript / academic record / كشف درجات)
- GPA/CGPA/cumulative/semester hits
- grade pattern density (letters / percentages / fractions near subjects)
- credit-system hits (credit hours / units / ECTS / ساعات معتمدة)
- row-like multi-column lines
Threshold: ≥4 ⇒ `transcript_strong`. Below + grad comparable ⇒ `graduation_preferred`.

## Honesty contracts
- `partial: true` always set on transcript intermediate in V1
- `coverage_estimate = rows_reconstructed / candidate_lines`
- Header confidence capped at 0.55 (well below AUTO_ACCEPT_THRESHOLD 0.85)
- GPA scale only set when explicit denominator (4 / 5 / 10 / 100) present
- Per-row `missing_columns` lists what was NOT found (subject/grade/credits/term)
- HONESTY GATE 3 enforces review-first regardless of confidence

## Runtime proof set
- A — born-digital clean transcript (harness ✅ — 8 rows, transcript_strong, 0 auto-accept)
- B — ambiguous grad vs transcript (harness ✅ — flipped to graduation_certificate)
- C — real degraded/scanned transcript (live upload, console `[Order2:TranscriptLane]`)

## NOT in Order 2
- No `academic.courses[]` canonical schema change
- No graduation/language overhaul
- No Assembly Experience changes
- No LLM / no OCR rewrite
