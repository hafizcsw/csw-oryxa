// ═══════════════════════════════════════════════════════════════
// Door 3 Semantic Layer — prompt templates (schema-first, JSON-only)
// ═══════════════════════════════════════════════════════════════
// Hard rules baked into every system prompt:
//  - Output MUST be valid JSON matching the given schema exactly.
//  - Unknown values = null. No guessing. No fabrication.
//  - Translate nothing. Use values exactly as they appear in OCR.
// ═══════════════════════════════════════════════════════════════

import type { SemanticLane } from './schemas.ts';

const COMMON_RULES = `
HARD RULES:
- Return ONLY a JSON object. No prose. No markdown.
- If a value is not clearly present in the OCR text, return null.
- Never invent or guess. Never translate names.
- Dates: normalize to YYYY-MM-DD ONLY when day/month/year are unambiguous; otherwise null.
- Trim whitespace. Preserve original character set (Arabic, Latin, etc.).
`.trim();

export interface PromptInput {
  /** Compact OCR evidence string (raw_text + table fragments). */
  evidence: string;
  /** Optional engine note for context (e.g. paddle_pp_structure_v3). */
  engine?: string;
}

export function buildPassportPrompt(p: PromptInput): { system: string; user: string } {
  const system = `You are a document field extractor for a PASSPORT.
${COMMON_RULES}

OUTPUT JSON SCHEMA:
{
  "full_name": string | null,
  "passport_number": string | null,
  "nationality": string | null,
  "date_of_birth": string | null,
  "expiry_date": string | null,
  "issuing_country": string | null,
  "sex": "M" | "F" | "X" | null,
  "mrz_present": boolean | null
}`;
  const user = `OCR engine: ${p.engine ?? 'unknown'}
OCR EVIDENCE:
"""
${p.evidence}
"""
Return JSON only.`;
  return { system, user };
}

export function buildCertificatePrompt(p: PromptInput): { system: string; user: string } {
  const system = `You are a document field extractor for an academic CERTIFICATE / DIPLOMA.
${COMMON_RULES}

OUTPUT JSON SCHEMA:
{
  "student_name": string | null,
  "institution_name": string | null,
  "certificate_title": string | null,
  "issue_date": string | null
}`;
  const user = `OCR engine: ${p.engine ?? 'unknown'}
OCR EVIDENCE:
"""
${p.evidence}
"""
Return JSON only.`;
  return { system, user };
}

export function buildTranscriptPrompt(p: PromptInput): { system: string; user: string } {
  const system = `You are a document field extractor for an academic TRANSCRIPT.
${COMMON_RULES}
- Each subject row MUST come from a clearly tabular structure in the evidence.
- Drop any row whose subject name is missing or that looks like a header/footer.

OUTPUT JSON SCHEMA:
{
  "student_name": string | null,
  "institution_name": string | null,
  "program_name": string | null,
  "gpa": number | null,
  "rows": [
    { "subject": string | null, "code": string | null, "credits": number | null, "grade": string | null, "term": string | null }
  ]
}`;
  const user = `OCR engine: ${p.engine ?? 'unknown'}
OCR EVIDENCE:
"""
${p.evidence}
"""
Return JSON only.`;
  return { system, user };
}

export function promptForLane(lane: SemanticLane, isTranscript: boolean, p: PromptInput) {
  if (lane === 'passport_lane') return buildPassportPrompt(p);
  if (lane === 'graduation_lane') {
    return isTranscript ? buildTranscriptPrompt(p) : buildCertificatePrompt(p);
  }
  return buildCertificatePrompt(p); // language_lane
}
