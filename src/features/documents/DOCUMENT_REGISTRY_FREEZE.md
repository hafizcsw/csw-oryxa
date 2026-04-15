// ═══════════════════════════════════════════════════════════════
// DOCUMENT_REGISTRY_FREEZE — Door 2 governance
// ═══════════════════════════════════════════════════════════════
//
// This document defines what Door 2 covers and what it DOES NOT.
//
// ── WHAT DOOR 2 PROVIDES ─────────────────────────────────────
// 1. DocumentRecord model with full field set
// 2. DOCUMENT_SLOT_TYPES covering 10 categories
// 3. CentralUploadHub component (drag-drop, multi-file, queue)
// 4. useDocumentRegistry hook (queue processing, status tracking)
// 5. Integration into StudyFileTab as the central upload surface
// 6. Per-file progress, success, failed, cancelled states
// 7. Simple file-name-based slot guessing (no AI, no overclaim)
//
// ── WHAT DOOR 2 DOES NOT DO ──────────────────────────────────
// - No OCR
// - No document parsing or extraction
// - No AI narration ("we found a passport")
// - No canonical field writes from documents
// - No eligibility or decision engine
// - No report generation
// - No OpenAI / Oryxa calls
// - No CRM sync writeback beyond existing upload protocol
// - No claim that a document has been "analyzed" or "understood"
//
// ── COMPATIBILITY ────────────────────────────────────────────
// - DocumentsTab still works as before (unchanged)
// - RequiredDocumentCard still works (unchanged)
// - AdditionalFilesTable still works (unchanged)
// - useStudentDocuments still works (unchanged)
// - Upload hub uses the same uploadAndRegisterFile protocol
// - Upload hub triggers refetch on batch complete
//
// ── FIELD STATUS SEMANTICS ───────────────────────────────────
// - readability_status = 'unknown' (until Door 3+)
// - usefulness_status = 'unknown' (until Door 3+)
// - duplicate_status = 'unknown' (until Door 3+)
// - rejection_reason = null (until Door 3+)
// - detected_document_type = file-name hint only, not AI
//
// ═══════════════════════════════════════════════════════════════
