---
name: Door 3 — Document Understanding + Proposals
description: Internal document analysis with PDF text extraction, MRZ parsing, regex classification, extraction proposals, and truth promotion rules
type: feature
---

## Models
- `DocumentAnalysis` in `document-analysis-model.ts` — analysis status, parser type, extracted fields, classification
- `ExtractionProposal` in `extraction-proposal-model.ts` — proposal lifecycle with auto-accept/pending/reject/superseded

## Parsers (all internal, no external LLM)
- `pdf-text-parser.ts` — pdfjs-dist text extraction
- `mrz-parser.ts` — TD3 passport MRZ regex parser
- `content-classifier.ts` — keyword/pattern classification
- `field-extractors.ts` — per-document-type regex extraction

## Engine
- `analysis-engine.ts` — orchestrates classify → extract → propose → promote

## Truth Promotion (V1)
- Promoted fields merge into CanonicalStudentFile via `useCanonicalStudentFile({ promotedFields })`
- `mergePromotedFields()` writes values into canonical blocks with `source_type: 'extracted'` provenance
- Auto-accept: low-risk field + confidence >= 0.85 + no conflict
- Pending review: ambiguity, conflicting current value
- Reject: null value, unsupported type, extraction failed

## Extraction Targets V1
- Passport: 7 identity fields via MRZ (PDF text only — no OCR for images in V1)
- Graduation cert: 6 academic fields via regex
- Transcript: 4 academic fields via regex
- Language cert: 8 language fields via regex

## HONEST GAPS (V1)
- **No image OCR**: Image uploads (jpg/png) get `filename_only` parser. No field extraction from images.
- **Passport image extraction does NOT work** in V1 — requires Tesseract.js (future)
- **No CRM writeback** — promoted values are session-local canonical overlay only
- **pendingFilesRef** uses unique keys (name+size+counter) to avoid duplicate filename collision

## NOT in Door 3
- No OpenAI / Oryxa
- No CRM writeback
- No eligibility / fit / report engine
- No CV / SOP / recommendation parsing
