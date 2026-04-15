// ═══════════════════════════════════════════════════════════════
// DOCUMENT_ANALYSIS_FREEZE — Door 3 governance
// ═══════════════════════════════════════════════════════════════
//
// ── WHAT DOOR 3 PROVIDES ─────────────────────────────────────
// 1. DocumentAnalysis model (analysis status, parser type, fields, confidence)
// 2. ExtractionProposal model (proposal lifecycle, truth promotion)
// 3. Internal parsers:
//    - PDF text extraction (pdfjs-dist)
//    - MRZ parser (regex-based, TD3 passport format)
//    - Content classifier (keyword/regex pattern matching)
//    - Field extractors (passport, graduation cert, transcript, language cert)
// 4. Analysis engine (orchestrator: classify → extract → propose → promote)
// 5. Truth promotion rules (auto-accept / pending-review / reject)
// 6. DocumentAnalysisPanel component (runtime surface)
// 7. useDocumentAnalysis hook (state management)
// 8. Integration into StudyFileTab (auto-analyze after upload)
//
// ── EXTRACTION TARGETS (V1) ──────────────────────────────────
// Passport:
//   identity.passport_name, identity.passport_number, identity.citizenship,
//   identity.date_of_birth, identity.gender, identity.passport_expiry_date,
//   identity.passport_issuing_country
//
// Graduation Certificate:
//   academic.credential_name, academic.credential_type,
//   academic.awarding_institution, academic.graduation_year,
//   academic.gpa_raw, academic.grading_scale
//
// Transcript:
//   academic.institution_name, academic.credential_name,
//   academic.gpa_raw, academic.grading_scale
//
// Language Certificate:
//   language.english_test_type, language.english_total_score,
//   language.english_reading_score, language.english_writing_score,
//   language.english_listening_score, language.english_speaking_score,
//   language.english_test_date, language.english_expiry_date
//
// ── TRUTH PROMOTION RULES ────────────────────────────────────
// Auto-accept: low-risk field + confidence >= 0.85 + no conflict
// Pending review: ambiguity, OCR uncertainty, conflicting value
// Reject: null value, extraction failed, unsupported type
//
// ── WHAT DOOR 3 DOES NOT DO ──────────────────────────────────
// - No OpenAI / external LLM
// - No Oryxa
// - No CRM sync writeback
// - No eligibility engine
// - No fit engine
// - No report engine
// - No services/improvement upsell
// - No CV parsing
// - No SOP parsing
// - No recommendation letter parsing
// - No advanced transcript subject engine
// - No program requirement KB
// - No student-facing improvement plan
// - No country/university counts
//
// ── WHAT REMAINS OPEN (Door 4+) ──────────────────────────────
// - [ ] Image OCR (Tesseract.js) for scanned documents
// - [ ] CV / SOP / recommendation parsers
// - [ ] Advanced transcript row parsing
// - [ ] Eligibility/decision engine
// - [ ] Report engine
// - [ ] CRM writeback of promoted fields
// - [ ] Multi-document conflict resolution
// - [ ] Confidence calibration from user feedback
//
// ═══════════════════════════════════════════════════════════════