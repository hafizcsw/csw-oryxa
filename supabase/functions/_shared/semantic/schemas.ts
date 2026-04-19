// ═══════════════════════════════════════════════════════════════
// Door 3 Semantic Layer — output schemas (per lane)
// ═══════════════════════════════════════════════════════════════
// Schema-first: AI must return JSON conforming to one of these.
// Unknown fields = null. No fabrication.
// ═══════════════════════════════════════════════════════════════

import { z } from 'https://esm.sh/zod@3.23.8';

export const PASSPORT_SCHEMA = z.object({
  full_name: z.string().nullable(),
  passport_number: z.string().nullable(),
  nationality: z.string().nullable(),
  date_of_birth: z.string().nullable(), // ISO YYYY-MM-DD when normalizable
  expiry_date: z.string().nullable(),
  issuing_country: z.string().nullable(),
  sex: z.enum(['M', 'F', 'X']).nullable(),
  mrz_present: z.boolean().nullable(),
});

export const CERTIFICATE_SCHEMA = z.object({
  student_name: z.string().nullable(),
  institution_name: z.string().nullable(),
  certificate_title: z.string().nullable(),
  issue_date: z.string().nullable(),
});

export const TRANSCRIPT_ROW = z.object({
  subject: z.string().nullable(),
  code: z.string().nullable(),
  credits: z.number().nullable(),
  grade: z.string().nullable(),
  term: z.string().nullable(),
});

export const TRANSCRIPT_SCHEMA = z.object({
  student_name: z.string().nullable(),
  institution_name: z.string().nullable(),
  program_name: z.string().nullable(),
  gpa: z.number().nullable(),
  rows: z.array(TRANSCRIPT_ROW),
});

export type PassportFacts = z.infer<typeof PASSPORT_SCHEMA>;
export type CertificateFacts = z.infer<typeof CERTIFICATE_SCHEMA>;
export type TranscriptFacts = z.infer<typeof TRANSCRIPT_SCHEMA>;

export type SemanticLane = 'passport_lane' | 'graduation_lane' | 'language_lane';

export function schemaForLane(lane: SemanticLane) {
  switch (lane) {
    case 'passport_lane': return PASSPORT_SCHEMA;
    case 'graduation_lane': return CERTIFICATE_SCHEMA;
    case 'language_lane': return CERTIFICATE_SCHEMA; // language uses same minimal cert shape
  }
}

export const TRANSCRIPT_INTENT = TRANSCRIPT_SCHEMA;
