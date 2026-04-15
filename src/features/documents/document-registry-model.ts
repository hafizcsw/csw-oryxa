// ═══════════════════════════════════════════════════════════════
// Document Registry Model — Door 2: Local document truth
// ═══════════════════════════════════════════════════════════════
// Every uploaded file becomes a typed DocumentRecord.
// No OCR. No extraction. No decision engine.
// Only upload orchestration + registry.
// ═══════════════════════════════════════════════════════════════

// ── Document slot types ──────────────────────────────────────
export const DOCUMENT_SLOT_TYPES = [
  'passport',
  'graduation_certificate',
  'transcript',
  'language_certificate',
  'cv',
  'statement_of_purpose',
  'recommendation_letter',
  'additional',
  'unknown',
  'unsupported',
] as const;

export type DocumentSlotType = typeof DOCUMENT_SLOT_TYPES[number];

// ── Processing status ────────────────────────────────────────
export type ProcessingStatus =
  | 'pending_upload'   // queued, not yet started
  | 'uploading'        // PUT in progress
  | 'confirming'       // confirm stage
  | 'registered'       // successfully in CRM registry
  | 'upload_failed'    // PUT or confirm failed
  | 'cancelled';       // user cancelled

// ── Simple statuses (no AI claims) ───────────────────────────
export type ReadabilityStatus = 'unknown' | 'readable' | 'unreadable';
export type UsefulnessStatus = 'unknown' | 'useful' | 'not_useful';
export type DuplicateStatus = 'unknown' | 'unique' | 'duplicate';

// ── Upload source surface ────────────────────────────────────
export type SourceSurface =
  | 'upload_hub'        // central upload hub (Door 2)
  | 'document_slot'     // existing RequiredDocumentCard
  | 'additional_table'  // existing AdditionalFilesTable
  | 'legacy';           // migrated from old path

// ── The Document Record ──────────────────────────────────────
export interface DocumentRecord {
  /** Unique ID — from CRM file_id after confirm, or local UUID before */
  document_id: string;
  /** Student user ID */
  student_id: string;
  /** Who initiated the upload */
  uploaded_by_role: 'student' | 'staff' | 'system';
  /** Which UI surface triggered the upload */
  source_surface: SourceSurface;
  /** Original file name as provided by the browser */
  original_file_name: string;
  /** MIME type */
  mime_type: string;
  /** File size in bytes */
  file_size_bytes: number;
  /** Storage path in CRM bucket */
  storage_path: string | null;
  /** Detected document type — null or simple hint only in Door 2 */
  detected_document_type: DocumentSlotType | null;
  /** Processing status */
  processing_status: ProcessingStatus;
  /** Readability — unknown until Door 3+ */
  readability_status: ReadabilityStatus;
  /** Usefulness — unknown until Door 3+ */
  usefulness_status: UsefulnessStatus;
  /** Duplicate detection — unknown until Door 3+ */
  duplicate_status: DuplicateStatus;
  /** Rejection reason — null in Door 2 */
  rejection_reason: string | null;
  /** CRM file URL after confirm */
  file_url: string | null;
  /** Signed URL for preview (transient) */
  signed_url: string | null;
  /** Upload error message if failed */
  error_message: string | null;
  /** Upload progress 0-100 */
  upload_progress: number;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────

/** Guess document type from file name — simple heuristic, no overclaim */
export function guessSlotFromFileName(fileName: string): DocumentSlotType {
  const lower = fileName.toLowerCase();
  if (/passport/i.test(lower)) return 'passport';
  if (/transcript/i.test(lower)) return 'transcript';
  if (/cv|resume|curriculum/i.test(lower)) return 'cv';
  if (/certificate|diploma|degree|graduation|شهادة/i.test(lower)) return 'graduation_certificate';
  if (/ielts|toefl|duolingo|language/i.test(lower)) return 'language_certificate';
  if (/sop|statement.*purpose|motivation/i.test(lower)) return 'statement_of_purpose';
  if (/recommendation|reference|letter/i.test(lower)) return 'recommendation_letter';
  return 'unknown';
}

/** Map legacy file_kind (from CRM) to DocumentSlotType */
export function mapLegacyKindToSlot(fileKind: string | null | undefined): DocumentSlotType {
  if (!fileKind) return 'unknown';
  const map: Record<string, DocumentSlotType> = {
    passport: 'passport',
    certificate: 'graduation_certificate',
    photo: 'additional', // photo is not a document slot per se
    additional: 'additional',
    general: 'additional',
    avatar: 'additional',
  };
  return map[fileKind] || 'unknown';
}

/** Create an empty DocumentRecord for a file about to be uploaded */
export function createPendingRecord(
  file: File,
  studentId: string,
  source: SourceSurface,
  slotHint?: DocumentSlotType | null,
): DocumentRecord {
  const now = new Date().toISOString();
  return {
    document_id: crypto.randomUUID(),
    student_id: studentId,
    uploaded_by_role: 'student',
    source_surface: source,
    original_file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
    storage_path: null,
    detected_document_type: slotHint ?? guessSlotFromFileName(file.name),
    processing_status: 'pending_upload',
    readability_status: 'unknown',
    usefulness_status: 'unknown',
    duplicate_status: 'unknown',
    rejection_reason: null,
    file_url: null,
    signed_url: null,
    error_message: null,
    upload_progress: 0,
    created_at: now,
    updated_at: now,
  };
}
