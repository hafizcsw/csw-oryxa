// ═══════════════════════════════════════════════════════════════
// Foundation — Normalized Document Model (official, V1)
// ═══════════════════════════════════════════════════════════════
// EVERY file — passport, transcript, garbage — gets one of these.
// Empty arrays are allowed. Hallucinated content is forbidden.
// This is the ONE shape downstream code is allowed to consume.
// ═══════════════════════════════════════════════════════════════

export interface NormalizedPage {
  page_number: number;
  width: number | null;
  height: number | null;
  /** Raw text extracted from the page. Empty string if none. */
  text: string;
}

export interface NormalizedBlock {
  page_number: number;
  block_index: number;
  text: string;
  bbox: [number, number, number, number] | null; // x,y,w,h or null
  role_hint: 'header' | 'body' | 'footer' | 'table' | 'unknown';
}

export interface NormalizedTable {
  page_number: number;
  rows: string[][];
  /** 0..1 — how confident we are this is a real table. */
  confidence: number;
}

export interface NormalizedKeyValue {
  key: string;
  value: string;
  page_number: number | null;
  /** Which provenance produced this kv (e.g. 'mrz_peek', 'filename_hint'). */
  source: string;
  /** 0..1 */
  confidence: number;
}

export interface NormalizedProvenance {
  /** Identifier of the producer (e.g. 'foundation-v1', 'paddle-self-hosted-v1'). */
  producer: string;
  /** True if no external service touched the raw bytes. */
  local_only: boolean;
  /** Free-form notes for audit. */
  notes: string[];
  /** When this normalized document was built. */
  built_at: string;
}

export interface NormalizedDocument {
  document_id: string;
  pages: NormalizedPage[];
  blocks: NormalizedBlock[];
  tables: NormalizedTable[];
  key_values: NormalizedKeyValue[];
  /** Concatenated raw text. Empty string allowed. */
  raw_text: string;
  /** Non-fatal issues observed during normalization. */
  warnings: string[];
  provenance: NormalizedProvenance;
}

export function emptyNormalizedDocument(
  documentId: string,
  producer = 'foundation-v1',
): NormalizedDocument {
  return {
    document_id: documentId,
    pages: [],
    blocks: [],
    tables: [],
    key_values: [],
    raw_text: '',
    warnings: [],
    provenance: {
      producer,
      local_only: true,
      notes: [],
      built_at: new Date().toISOString(),
    },
  };
}
