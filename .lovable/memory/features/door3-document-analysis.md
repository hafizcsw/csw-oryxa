---
name: Door 3 — Document Understanding + Proposals
description: Internal document analysis with PDF text extraction, MRZ parsing, regex classification, extraction proposals, lane-specific promotion gates, and trial-safe persistence
type: feature
---

## Models
- `DocumentAnalysis` in `document-analysis-model.ts`
- `ExtractionProposal` in `extraction-proposal-model.ts`
- `StructuredDocumentArtifact` in `structured-browser-artifact-model.ts` — local-only browser artifact

## Parsers (all internal, no external LLM)
- `pdf-text-parser.ts` — pdfjs-dist
- `mrz-parser.ts` — TD3
- `content-classifier.ts`
- `field-extractors.ts`
- `transcript-parser.ts` — consumes structured artifact (transcript lane only)
- `browser-preprocessing.ts` + `structured-artifact-builder.ts` — local heuristic

## Engine
- `analysis-engine.ts` — orchestrates classify → extract → propose → promote

## Truth Promotion (V1) — HONESTY GATES
- GATE 1: degraded readability → never auto-accept
- GATE 2: passport identity requires MRZ + passport_strong
- GATE 3: transcript lane = always pending_review
- GATE 4: graduation lane = always pending_review (no auto-accept, ever, in V1)
- GATE 5: language lane narrow auto-accept whitelist:
  - only `language.english_test_type` and `language.english_total_score`
  - requires readable + confidence ≥ 0.9 + trusted parser source + no conflict
  - all other language fields → pending_review (expiry never masquerades as explicit)

## Trial-safe persistence (compact 2-table schema)
- `engine-persistence.ts` + `useDocumentAnalysis` hydration
- Tables: `document_analyses`, `extraction_proposals` (RLS: per-user)
- Artifact + structured artifact persisted as SUMMARY JSONB only
- Promoted state DERIVED from proposal status (auto_accepted)
- Reload-safe: hook hydrates on mount per user

## Transcript coverage honesty
- denominator = base_row_like + structured_unique_added (no double counting)
- evidence_summary exposes base / struct_seen / struct_unique

## NOT in Door 3
- No OpenAI / no LLM / no outbound document-content path
- No CRM writeback
- No image OCR auto-accept
- No graduation auto-accept
- No language auto-accept beyond the narrow 2-field whitelist
