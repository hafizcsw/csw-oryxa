// ═══════════════════════════════════════════════════════════════
// MRZ parser — STUB (legacy parser removed)
// ═══════════════════════════════════════════════════════════════
// Real MRZ parsing is delegated to the upcoming Mistral pipeline.
// This stub preserves the type surface so callers compile.
// ═══════════════════════════════════════════════════════════════

export interface MrzResult {
  detected: boolean;
  raw: string | null;
  full_name: string | null;
  passport_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  expiry_date: string | null;
  issuing_country: string | null;
  sex: string | null;
  notes: string[];
}

export function parseMrz(_text: string): MrzResult {
  return {
    detected: false,
    raw: null,
    full_name: null,
    passport_number: null,
    nationality: null,
    date_of_birth: null,
    expiry_date: null,
    issuing_country: null,
    sex: null,
    notes: ['mrz_parser_stub_pending_mistral'],
  };
}
