// ═══════════════════════════════════════════════════════════════
// Structured Artifact Builder — In-Browser Document Intelligence
// ═══════════════════════════════════════════════════════════════
// Builds a StructuredDocumentArtifact from a ReadingArtifact.
// Pure heuristics over already-extracted text. Browser-only.
// No outbound HTTP. No LLM. No new dependencies.
// ═══════════════════════════════════════════════════════════════

import type { ReadingArtifact, PageReading } from '../reading-artifact-model';
import {
  type StructuredDocumentArtifact,
  type StructuredPage,
  type LineGroup,
  type RowCandidate,
  type TableLikeRegion,
  emptyStructuredArtifact,
} from '../structured-browser-artifact-model';
import { normalizePageLines, scorePageQuality } from './browser-preprocessing';

/** Split a line into "cells" by 2+ spaces, tabs, or pipe-like separators. */
function splitCells(line: string): string[] {
  return line
    .split(/\s{2,}|\t+|\s\|\s/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

const GRADE_TOKEN_RE = /\b([A-DF][+\-]?|\d{1,3}(?:\.\d+)?\s*%|\d{1,3}(?:\.\d+)?\s*\/\s*(?:100|10|5|4(?:\.0+)?))\b/;
const COURSE_CODE_RE = /\b[A-Z]{2,4}\s?\d{2,4}[A-Z]?\b/;
const SUBJECT_TEXT_RE = /[A-Za-z\u0600-\u06FF]{4,}/;

function buildRowCandidate(pageNumber: number, line: string): RowCandidate {
  const cells = splitCells(line);
  const hasGrade = GRADE_TOKEN_RE.test(line);
  const hasCode = COURSE_CODE_RE.test(line);
  const hasSubjectish = SUBJECT_TEXT_RE.test(line);
  const isTabular = cells.length >= 3 && hasSubjectish && (hasGrade || hasCode);

  // Confidence: base + signals
  let conf = 0;
  if (hasSubjectish) conf += 0.3;
  if (hasGrade) conf += 0.3;
  if (hasCode) conf += 0.2;
  if (cells.length >= 3) conf += 0.15;
  if (cells.length >= 5) conf += 0.05;
  conf = Math.min(conf, 0.9);

  return {
    page_number: pageNumber,
    raw_line: line.slice(0, 240),
    cells,
    is_tabular: isTabular,
    row_confidence: conf,
  };
}

/** Detect contiguous runs of tabular rows with similar column counts. */
function detectTableRegions(pageNumber: number, rows: RowCandidate[]): TableLikeRegion[] {
  const regions: TableLikeRegion[] = [];
  let runStart = -1;
  let runCols = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.is_tabular) {
      if (runStart < 0) {
        runStart = i;
        runCols = r.cells.length;
      } else {
        runCols = Math.max(runCols, r.cells.length);
      }
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len >= 2) {
        regions.push({
          page_number: pageNumber,
          row_indices: Array.from({ length: len }, (_, k) => runStart + k),
          approx_columns: runCols,
          row_count: len,
        });
      }
      runStart = -1;
      runCols = 0;
    }
  }
  if (runStart >= 0) {
    const len = rows.length - runStart;
    if (len >= 2) {
      regions.push({
        page_number: pageNumber,
        row_indices: Array.from({ length: len }, (_, k) => runStart + k),
        approx_columns: runCols,
        row_count: len,
      });
    }
  }
  return regions;
}

/** Group lines by simple role hint (header / footer / body / table_row). */
function buildLineGroups(
  pageNumber: number,
  lines: string[],
  rows: RowCandidate[],
): LineGroup[] {
  const groups: LineGroup[] = [];
  if (lines.length === 0) return groups;

  const tabularSet = new Set(rows.filter(r => r.is_tabular).map(r => r.raw_line));

  // Header = first 1–2 lines if short and non-tabular
  const headerCount = Math.min(2, lines.length);
  for (let i = 0; i < headerCount; i++) {
    const l = lines[i];
    if (l.length <= 120 && !tabularSet.has(l.slice(0, 240))) {
      groups.push({
        page_number: pageNumber,
        text: l,
        line_indices: [i],
        role_hint: 'header',
      });
    }
  }

  // Footer = last 1 line if it looks short / page-numbery
  const lastIdx = lines.length - 1;
  if (lastIdx >= 2) {
    const last = lines[lastIdx];
    if (last.length <= 80 && /\d/.test(last)) {
      groups.push({
        page_number: pageNumber,
        text: last,
        line_indices: [lastIdx],
        role_hint: 'footer',
      });
    }
  }

  // Tabular rows
  for (let i = 0; i < lines.length; i++) {
    if (tabularSet.has(lines[i].slice(0, 240))) {
      groups.push({
        page_number: pageNumber,
        text: lines[i],
        line_indices: [i],
        role_hint: 'table_row',
      });
    }
  }

  return groups;
}

function buildStructuredPage(page: PageReading): StructuredPage {
  const lines = normalizePageLines(page.text || '');
  const quality = scorePageQuality(page);
  const rows: RowCandidate[] = lines.map(l => buildRowCandidate(page.page_number, l));
  const tableRegions = detectTableRegions(page.page_number, rows);
  const lineGroups = buildLineGroups(page.page_number, lines, rows);

  return {
    page_number: page.page_number,
    text: page.text,
    line_count: lines.length,
    quality,
    line_groups: lineGroups,
    row_candidates: rows,
    table_like_regions: tableRegions,
  };
}

/**
 * Build the StructuredDocumentArtifact from a ReadingArtifact.
 * Browser-only. Pure heuristics. Never throws — returns empty on failure.
 */
export function buildStructuredBrowserArtifact(
  reading: ReadingArtifact,
): StructuredDocumentArtifact {
  const start = performance.now();
  const empty = emptyStructuredArtifact();

  if (!reading.pages || reading.pages.length === 0) {
    empty.build_time_ms = performance.now() - start;
    return empty;
  }

  try {
    const pages = reading.pages.map(buildStructuredPage);
    const reading_order = pages.map(p => p.page_number);

    const total_row_candidates = pages.reduce((s, p) => s + p.row_candidates.length, 0);
    const tabular_row_candidates = pages.reduce(
      (s, p) => s + p.row_candidates.filter(r => r.is_tabular).length,
      0,
    );
    const table_like_region_count = pages.reduce((s, p) => s + p.table_like_regions.length, 0);
    const header_groups = pages.reduce(
      (s, p) => s + p.line_groups.filter(g => g.role_hint === 'header').length,
      0,
    );
    const footer_groups = pages.reduce(
      (s, p) => s + p.line_groups.filter(g => g.role_hint === 'footer').length,
      0,
    );
    const avg_quality_score =
      pages.length > 0
        ? pages.reduce((s, p) => s + p.quality.quality_score, 0) / pages.length
        : 0;

    return {
      builder: 'browser_local_v1',
      local_only: true,
      pages,
      reading_order,
      summary: {
        pages_analyzed: pages.length,
        total_row_candidates,
        tabular_row_candidates,
        table_like_region_count,
        header_groups,
        footer_groups,
        avg_quality_score,
      },
      build_time_ms: performance.now() - start,
    };
  } catch {
    empty.build_time_ms = performance.now() - start;
    return empty;
  }
}
