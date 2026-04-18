---
name: Door 3 — Document Understanding + Proposals
description: Internal document analysis with PDF text extraction, full ICAO 9303 MRZ (TD1/TD2/TD3 + check-digits), regex classification, multilingual passport keywords, extraction proposals, lane-specific promotion gates, unified PassportOutput schema, and trial-safe persistence
type: feature
---

## Models
- `DocumentAnalysis` in `document-analysis-model.ts`
- `ExtractionProposal` in `extraction-proposal-model.ts`
- `StructuredDocumentArtifact` in `structured-browser-artifact-model.ts` — local-only browser artifact
- `PassportOutput` in `passport-output-schema.ts` — unified university-ready JSON

## Parsers (all internal, no external LLM)
- `pdf-text-parser.ts` — pdfjs-dist
- `mrz-parser.ts` — full ICAO 9303: TD1 (3×30), TD2 (2×36), TD3 (2×44) + check-digit verification (passport_number, DOB, expiry, composite)
- `iso-country-codes.ts` — 250+ ISO 3166-1 entries (alpha3 → alpha2 + name_en + name_ar), incl. territories (HKG, MAC, TWN, PSE, RKS Kosovo) and ICAO MRZ-only codes
- `content-classifier.ts` — multilingual passport keywords: en/ar/fr/es/de/ru/zh
- `field-extractors.ts`
- `transcript-parser.ts` — consumes structured artifact (transcript lane only)
- `browser-preprocessing.ts` + `structured-artifact-builder.ts` — local heuristic

## Engine
- `analysis-engine.ts` — orchestrates classify → extract → propose → promote
- Emits `passport_output: PassportOutput | null` on `AnalysisResult` (passport lane with viable MRZ only)
- MRZ trust boost: `checksum_verified === true` raises classification confidence to ≥ 0.95

## Truth Promotion (V1) — HONESTY GATES
- GATE 1: degraded readability → never auto-accept
- GATE 2: passport identity requires MRZ + passport_strong
- GATE 3: transcript lane = always pending_review
- GATE 4: graduation lane = always pending_review (no auto-accept, ever, in V1)
- GATE 5: language lane narrow auto-accept whitelist (only 2 fields)

## PassportOutput Schema (university-ready)
- `personal_info`: first_name, last_name, full_name_mrz, date_of_birth{raw, formatted}, gender, nationality{name, iso_code_3, iso_code_2}, place_of_birth
- `document_info`: passport_number, document_type, issuing_country{name, iso_code_3, iso_code_2}, issue_date, expiry_date, is_expired, days_until_expiry
- `mrz_details`: format (TD1/TD2/TD3), line_1, line_2, line_3, checksum_verified, checksum_breakdown{passport_number, date_of_birth, expiry_date, composite}
- `engine_metadata`: confidence_score, processing_time_ms, schema_version, parser_chain, ocr_used
- All unknown fields → `null` (never fabricated)

## Trial-safe persistence
- `engine-persistence.ts` + `useDocumentAnalysis` hydration
- Tables: `document_analyses`, `extraction_proposals` (RLS: per-user, all 4 verbs)
- Reload-safe; provenance honest (`decided_by` 'user'|'engine')

## NOT in Door 3
- No OpenAI / no LLM / no outbound document-content path
- No CRM writeback
- No image OCR auto-accept
- No graduation auto-accept
- No language auto-accept beyond the narrow 2-field whitelist
