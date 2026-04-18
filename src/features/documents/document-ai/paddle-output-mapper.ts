// ═══════════════════════════════════════════════════════════════
// Paddle Output Mapper
// ═══════════════════════════════════════════════════════════════
// Translates raw PP-StructureV3 service output into the internal
// StructuredDocumentArtifact. Raw Paddle types DO NOT leak past
// this file.
//
// Contract:
//   - Returns an artifact tagged builder='paddle_self_hosted_v1'.
//   - Maps: text blocks, header/footer hints, row candidates,
//           table-like regions, reading order, page quality.
//   - Truth-discipline: this is HINT material only. Lanes still
//     decide via existing extractors and promotion rules.
// ═══════════════════════════════════════════════════════════════

import type {
  StructuredDocumentArtifact,
  StructuredPage,
  PageQualityFlags,
  LineGroup,
  RowCandidate,
  TableLikeRegion,
} from '../structured-browser-artifact-model';

/** Loose shape we expect from the self-hosted service.
 *  Kept narrow: only fields we actually map. */
export interface PaddleStructureResponse {
  pages: PaddlePage[];
  /** Optional reading order across pages. If absent, derived sequentially. */
  reading_order?: number[];
  build_time_ms?: number;
}

export interface PaddlePage {
  page_number: number;
  width?: number;
  height?: number;
  /** Free text reconstruction (for downstream parsers that still want text). */
  text?: string;
  blocks?: PaddleBlock[];
  tables?: PaddleTable[];
  /** Optional 0..1 page quality from the model. */
  quality_score?: number;
}

export interface PaddleBlock {
  /** layout role classification, e.g. 'title', 'text', 'header', 'footer',
   *  'table', 'figure', 'list', 'reference'. */
  role?: string;
  text?: string;
  /** 0..1 model confidence. */
  confidence?: number;
  /** [x1,y1,x2,y2] in pixel coords. Only used to order/cluster. */
  bbox?: [number, number, number, number];
}

export interface PaddleTable {
  /** 2-D string grid, rows x cols, post-OCR. */
  cells: string[][];
  /** Optional bbox for the whole table. */
  bbox?: [number, number, number, number];
  /** Optional 0..1 confidence. */
  confidence?: number;
}

// ── Helpers ──────────────────────────────────────────────────

function deriveQuality(p: PaddlePage): PageQualityFlags {
  const blocks = p.blocks ?? [];
  const totalChars = blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  const lineCount = (p.text ?? '').split(/\r?\n/).filter(l => l.trim().length > 0).length;
  const qScore = clamp01(p.quality_score ?? (totalChars > 200 ? 0.8 : totalChars > 40 ? 0.5 : 0.2));
  return {
    quality_score: qScore,
    is_low_signal: totalChars < 40,
    is_noisy: blocks.length > 0 && blocks.every(b => (b.text?.length ?? 0) < 6),
    looks_like_cover: lineCount > 0 && lineCount <= 4 && totalChars < 120,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isHeaderRole(role?: string): boolean {
  if (!role) return false;
  return /^(header|title|page_header)$/i.test(role);
}

function isFooterRole(role?: string): boolean {
  if (!role) return false;
  return /^(footer|page_footer|page_number)$/i.test(role);
}

function buildLineGroups(p: PaddlePage): LineGroup[] {
  const groups: LineGroup[] = [];
  const blocks = p.blocks ?? [];
  blocks.forEach((b, idx) => {
    const text = (b.text ?? '').trim();
    if (!text) return;
    const role_hint: LineGroup['role_hint'] =
      isHeaderRole(b.role) ? 'header'
      : isFooterRole(b.role) ? 'footer'
      : (b.role && /table/i.test(b.role)) ? 'table_row'
      : 'body';
    groups.push({
      page_number: p.page_number,
      text,
      line_indices: [idx],
      role_hint,
    });
  });
  return groups;
}

function buildRowCandidatesFromTable(
  page_number: number,
  table: PaddleTable,
): RowCandidate[] {
  const out: RowCandidate[] = [];
  for (const row of table.cells) {
    const cells = row.map(c => (c ?? '').trim()).filter(c => c.length > 0);
    if (cells.length === 0) continue;
    const raw_line = cells.join('  ');
    out.push({
      page_number,
      raw_line,
      cells,
      is_tabular: cells.length >= 2,
      row_confidence: clamp01(table.confidence ?? 0.7),
    });
  }
  return out;
}

function buildTableLikeRegions(
  page_number: number,
  rowCandidates: RowCandidate[],
  tables: PaddleTable[],
): TableLikeRegion[] {
  // Simple mapping: each table → one region, indexed by the row range it produced.
  const regions: TableLikeRegion[] = [];
  let cursor = 0;
  for (const t of tables) {
    const row_count = t.cells.filter(r => r.some(c => (c ?? '').trim().length > 0)).length;
    if (row_count === 0) continue;
    const indices: number[] = [];
    for (let i = 0; i < row_count; i++) indices.push(cursor + i);
    cursor += row_count;
    const approx_columns = Math.max(...t.cells.map(r => r.length), 0);
    regions.push({
      page_number,
      row_indices: indices,
      approx_columns,
      row_count,
    });
  }
  return regions;
}

// ── Public mapper ────────────────────────────────────────────

export function mapPaddleResponseToArtifact(
  resp: PaddleStructureResponse,
): StructuredDocumentArtifact {
  const startedAt = (resp.build_time_ms ?? 0);
  const pagesIn = Array.isArray(resp.pages) ? resp.pages : [];

  const pages: StructuredPage[] = pagesIn.map(p => {
    const lineGroups = buildLineGroups(p);
    const rowCandidates: RowCandidate[] = [];
    for (const t of (p.tables ?? [])) {
      rowCandidates.push(...buildRowCandidatesFromTable(p.page_number, t));
    }
    let regions = buildTableLikeRegions(p.page_number, rowCandidates, p.tables ?? []);

    // ─── TEXT-DERIVED ROW FALLBACK ───────────────────────────
    // Many transcripts come back from Paddle with `tables: []` even when
    // the page IS visually tabular — the table-detector is finicky on
    // photos / low-DPI scans. We can still recover a tabular signal by
    // scanning `p.text`: lines with ≥2 columns separated by 2+ spaces
    // (or tabs) are treated as row candidates. A page that yields ≥4
    // such rows synthesizes ONE table_like_region so the classifier's
    // structural boost can fire and the doc is routed to transcript.
    if (rowCandidates.length === 0 && (p.text ?? '').trim().length > 0) {
      const lines = (p.text ?? '').split(/\r?\n/);
      const synthRows: RowCandidate[] = [];
      const COL_SPLIT = /\s{2,}|\t+/;
      for (const ln of lines) {
        const trimmed = ln.trim();
        if (trimmed.length < 4) continue;
        const cells = trimmed.split(COL_SPLIT).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          synthRows.push({
            page_number: p.page_number,
            raw_line: trimmed,
            cells,
            is_tabular: cells.length >= 2,
            row_confidence: 0.4, // synthetic, lower than real Paddle table rows
          });
        }
      }
      if (synthRows.length >= 4) {
        rowCandidates.push(...synthRows);
        regions = [
          {
            page_number: p.page_number,
            row_indices: synthRows.map((_, i) => i),
            approx_columns: Math.max(...synthRows.map(r => r.cells.length), 0),
            row_count: synthRows.length,
          },
        ];
      }
    }
    const quality = deriveQuality(p);
    const text = (p.text ?? lineGroups.map(g => g.text).join('\n')).trim();
    const line_count = text ? text.split(/\r?\n/).filter(l => l.trim().length > 0).length : 0;
    return {
      page_number: p.page_number,
      text,
      line_count,
      quality,
      line_groups: lineGroups,
      row_candidates: rowCandidates,
      table_like_regions: regions,
    };
  });

  const reading_order =
    Array.isArray(resp.reading_order) && resp.reading_order.length === pages.length
      ? resp.reading_order
      : pages.map(p => p.page_number);

  const totalRow = pages.reduce((n, p) => n + p.row_candidates.length, 0);
  const tabRow = pages.reduce(
    (n, p) => n + p.row_candidates.filter(r => r.is_tabular).length,
    0,
  );
  const tableRegions = pages.reduce((n, p) => n + p.table_like_regions.length, 0);
  const headerGroups = pages.reduce(
    (n, p) => n + p.line_groups.filter(g => g.role_hint === 'header').length,
    0,
  );
  const footerGroups = pages.reduce(
    (n, p) => n + p.line_groups.filter(g => g.role_hint === 'footer').length,
    0,
  );
  const avgQ = pages.length
    ? pages.reduce((n, p) => n + p.quality.quality_score, 0) / pages.length
    : 0;

  return {
    builder: 'paddle_self_hosted_v1',
    local_only: true, // boundary still local from app's POV; data flowed via our edge proxy
    pages,
    reading_order,
    summary: {
      pages_analyzed: pages.length,
      total_row_candidates: totalRow,
      tabular_row_candidates: tabRow,
      table_like_region_count: tableRegions,
      header_groups: headerGroups,
      footer_groups: footerGroups,
      avg_quality_score: avgQ,
    },
    build_time_ms: Math.max(0, startedAt),
  };
}
