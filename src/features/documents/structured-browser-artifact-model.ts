// ═══════════════════════════════════════════════════════════════
// Structured Browser Artifact — In-Browser Document Intelligence
// ═══════════════════════════════════════════════════════════════
// Browser-only structured layer built on top of ReadingArtifact.
// Adds: line groups, row candidates, table-like regions,
//       header/footer hints, page quality flags.
//
// HARD CONTRACT:
//   - Built ENTIRELY in-browser. No outbound HTTP. No LLM. No API.
//   - This is NOT canonical truth. Lanes consume it as a hint only.
//   - Honesty gates remain enforced upstream (ReadingArtifact).
// ═══════════════════════════════════════════════════════════════

export type ArtifactBuilderImplementation =
  | 'browser_local_v1'   // current in-browser builder
  | 'none';

export interface PageQualityFlags {
  /** Page-level quality 0..1 derived from OCR/text density */
  quality_score: number;
  /** True if page is mostly empty / low-signal */
  is_low_signal: boolean;
  /** True if rows/lines look noisy (lots of short tokens) */
  is_noisy: boolean;
  /** True if page looks like a header/cover (few lines, large gaps) */
  looks_like_cover: boolean;
}

export interface LineGroup {
  page_number: number;
  /** Joined text of grouped lines */
  text: string;
  /** Original line indices (within page) */
  line_indices: number[];
  /** Hint about what this group looks like */
  role_hint: 'header' | 'footer' | 'body' | 'table_row' | 'unknown';
}

export interface RowCandidate {
  page_number: number;
  /** Raw line text */
  raw_line: string;
  /** Tokens split by 2+ spaces (column-like split heuristic) */
  cells: string[];
  /** Heuristic: does this look like a tabular row? */
  is_tabular: boolean;
  /** 0..1 — confidence the line is an actual data row */
  row_confidence: number;
}

export interface TableLikeRegion {
  page_number: number;
  /** Indices of consecutive row candidates forming the region */
  row_indices: number[];
  /** Approx column count derived from cell counts */
  approx_columns: number;
  /** Number of contiguous tabular rows */
  row_count: number;
}

export interface StructuredPage {
  page_number: number;
  text: string;
  line_count: number;
  quality: PageQualityFlags;
  line_groups: LineGroup[];
  row_candidates: RowCandidate[];
  table_like_regions: TableLikeRegion[];
}

export interface StructuredArtifactSummary {
  pages_analyzed: number;
  total_row_candidates: number;
  tabular_row_candidates: number;
  table_like_region_count: number;
  header_groups: number;
  footer_groups: number;
  avg_quality_score: number;
}

export interface StructuredDocumentArtifact {
  builder: ArtifactBuilderImplementation;
  /** Confirms processing stayed in-browser. Always true for browser_local_v1. */
  local_only: true;
  pages: StructuredPage[];
  reading_order: number[]; // page numbers in reading order (1..N)
  summary: StructuredArtifactSummary;
  build_time_ms: number;
}

export function emptyStructuredArtifact(): StructuredDocumentArtifact {
  return {
    builder: 'none',
    local_only: true,
    pages: [],
    reading_order: [],
    summary: {
      pages_analyzed: 0,
      total_row_candidates: 0,
      tabular_row_candidates: 0,
      table_like_region_count: 0,
      header_groups: 0,
      footer_groups: 0,
      avg_quality_score: 0,
    },
    build_time_ms: 0,
  };
}
