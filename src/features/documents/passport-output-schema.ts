// ═══════════════════════════════════════════════════════════════
// Passport Output Schema — unified, university-ready payload
// ═══════════════════════════════════════════════════════════════
// A clean JSON shape that any university SIS / admissions system
// can consume directly. Built from MrzResult + engine metadata.
// All fields nullable when unknown — NEVER fabricated.
// ═══════════════════════════════════════════════════════════════

import type { MrzResult } from './parsers/mrz-parser';
import { lookupCountry } from './parsers/iso-country-codes';

export const PASSPORT_OUTPUT_VERSION = 'v1.0.0';

export interface PassportPersonalInfo {
  first_name: string | null;
  last_name: string | null;
  full_name_mrz: string | null;
  date_of_birth: {
    raw: string | null;       // MRZ raw YYMMDD
    formatted: string | null; // ISO YYYY-MM-DD
  };
  gender: 'M' | 'F' | 'X' | null;
  nationality: {
    name: string | null;
    iso_code_3: string | null;
    iso_code_2: string | null;
  };
  place_of_birth: string | null;
}

export interface PassportDocumentInfo {
  passport_number: string | null;
  document_type: string | null;          // 'P', 'PD', 'PS', 'V', 'I', 'A', 'C'
  issuing_country: {
    name: string | null;
    iso_code_3: string | null;
    iso_code_2: string | null;
  };
  issue_date: string | null;             // YYYY-MM-DD (derived)
  expiry_date: string | null;            // YYYY-MM-DD
  is_expired: boolean | null;
  days_until_expiry: number | null;
}

export interface PassportMrzDetails {
  format: 'TD1' | 'TD2' | 'TD3' | null;
  line_1: string | null;
  line_2: string | null;
  line_3: string | null;                 // TD1 only
  checksum_verified: boolean;
  checksum_breakdown: {
    passport_number: boolean | null;
    date_of_birth: boolean | null;
    expiry_date: boolean | null;
    composite: boolean | null;
  };
}

export interface PassportEngineMetadata {
  confidence_score: number;              // 0.0 – 1.0
  processing_time_ms: number;
  schema_version: string;                // PASSPORT_OUTPUT_VERSION
  parser_chain: string[];                // e.g. ['pdf_text', 'mrz_td3']
  ocr_used: boolean;
}

export interface PassportOutput {
  personal_info: PassportPersonalInfo;
  document_info: PassportDocumentInfo;
  mrz_details: PassportMrzDetails;
  engine_metadata: PassportEngineMetadata;
}

// ── Builder ──────────────────────────────────────────────────

function splitName(fullMrz: string | null, surname: string | null, given: string | null) {
  return {
    first_name: given || null,
    last_name: surname || null,
    full_name_mrz: fullMrz || (surname && given ? `${surname}<<${given}` : surname || given || null),
  };
}

function computeExpiryFlags(expiryYmd: string | null): { is_expired: boolean | null; days: number | null } {
  if (!expiryYmd) return { is_expired: null, days: null };
  const exp = new Date(expiryYmd + 'T00:00:00Z');
  if (isNaN(exp.getTime())) return { is_expired: null, days: null };
  const now = Date.now();
  const ms = exp.getTime() - now;
  const days = Math.round(ms / 86_400_000);
  return { is_expired: ms < 0, days };
}

function dobRawFromYmd(ymd: string | null): string | null {
  if (!ymd) return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

export interface BuildPassportOutputParams {
  mrz: MrzResult;
  derived_issue_date: string | null;
  processing_time_ms: number;
  parser_chain: string[];
  ocr_used: boolean;
}

export function buildPassportOutput(params: BuildPassportOutputParams): PassportOutput {
  const { mrz, derived_issue_date, processing_time_ms, parser_chain, ocr_used } = params;

  const nationality = lookupCountry(mrz.nationality_alpha3);
  const issuing = lookupCountry(mrz.issuing_country_alpha3);
  const names = splitName(mrz.raw_mrz_line1 || null, mrz.surname, mrz.given_names);
  const expiryFlags = computeExpiryFlags(mrz.expiry_date);

  return {
    personal_info: {
      ...names,
      date_of_birth: {
        raw: dobRawFromYmd(mrz.date_of_birth),
        formatted: mrz.date_of_birth,
      },
      gender: (mrz.gender as 'M' | 'F' | 'X' | null) ?? null,
      nationality: {
        name: nationality?.name_en ?? mrz.nationality ?? null,
        iso_code_3: mrz.nationality_alpha3 ?? null,
        iso_code_2: nationality?.alpha2 ?? null,
      },
      place_of_birth: null, // not encoded in MRZ; left explicitly null
    },
    document_info: {
      passport_number: mrz.passport_number,
      document_type: mrz.document_type,
      issuing_country: {
        name: issuing?.name_en ?? mrz.issuing_country ?? null,
        iso_code_3: mrz.issuing_country_alpha3 ?? null,
        iso_code_2: issuing?.alpha2 ?? null,
      },
      issue_date: derived_issue_date,
      expiry_date: mrz.expiry_date,
      is_expired: expiryFlags.is_expired,
      days_until_expiry: expiryFlags.days,
    },
    mrz_details: {
      format: mrz.format,
      line_1: mrz.raw_mrz_line1,
      line_2: mrz.raw_mrz_line2,
      line_3: mrz.raw_mrz_line3,
      checksum_verified: mrz.checksum_verified,
      checksum_breakdown: mrz.checksum_breakdown,
    },
    engine_metadata: {
      confidence_score: Number(mrz.confidence.toFixed(3)),
      processing_time_ms: Math.round(processing_time_ms),
      schema_version: PASSPORT_OUTPUT_VERSION,
      parser_chain,
      ocr_used,
    },
  };
}
