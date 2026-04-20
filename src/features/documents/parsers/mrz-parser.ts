// ═══════════════════════════════════════════════════════════════
// MRZ parser — STUB (legacy parser removed)
// ═══════════════════════════════════════════════════════════════
// Real MRZ parsing is delegated to the upcoming Mistral pipeline.
// This stub preserves the full type surface so existing callers
// (foundation/classifier, foundation/evidence-extractor, passport
// lane) continue to compile. It always reports `found: false`.
// ═══════════════════════════════════════════════════════════════

export interface MrzChecksumBreakdown {
  passport_number: boolean | null;
  date_of_birth: boolean | null;
  expiry_date: boolean | null;
  composite: boolean | null;
}

export interface MrzResult {
  found: boolean;
  format: 'TD1' | 'TD2' | 'TD3' | null;
  checksum_verified: boolean;
  checksum_breakdown: MrzChecksumBreakdown;
  confidence: number;
  raw: string | null;
  // Identity
  surname: string | null;
  given_names: string | null;
  full_name: string | null;
  // Document
  passport_number: string | null;
  nationality: string | null;
  nationality_alpha3: string | null;
  issuing_country: string | null;
  issuing_country_alpha3: string | null;
  // Dates
  date_of_birth: string | null;
  expiry_date: string | null;
  // Other
  gender: string | null;
  notes: string[];
}

export function parseMrz(_text: string): MrzResult {
  return {
    found: false,
    format: null,
    checksum_verified: false,
    checksum_breakdown: {
      passport_number: null,
      date_of_birth: null,
      expiry_date: null,
      composite: null,
    },
    confidence: 0,
    raw: null,
    surname: null,
    given_names: null,
    full_name: null,
    passport_number: null,
    nationality: null,
    nationality_alpha3: null,
    issuing_country: null,
    issuing_country_alpha3: null,
    date_of_birth: null,
    expiry_date: null,
    gender: null,
    notes: ['mrz_parser_stub_pending_mistral'],
  };
}
