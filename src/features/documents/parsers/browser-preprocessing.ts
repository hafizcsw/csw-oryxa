// ═══════════════════════════════════════════════════════════════
// Browser Preprocessing — Light, dependency-free utilities
// ═══════════════════════════════════════════════════════════════
// Pure browser-side helpers. No outbound calls. No new deps.
// Used by the structured artifact builder for page quality scoring
// and (optionally, future) canvas grayscale normalization.
// ═══════════════════════════════════════════════════════════════

import type { PageReading } from '../reading-artifact-model';
import type { PageQualityFlags } from '../structured-browser-artifact-model';

/**
 * Score a single page's quality based on its OCR/text content.
 * Pure heuristic — no external dependencies.
 *  - quality_score: 0..1 mixing density + token sanity
 *  - is_low_signal: page barely has content
 *  - is_noisy: mostly very short tokens (typical OCR garbage trail)
 *  - looks_like_cover: very few lines but contains long-ish text
 */
export function scorePageQuality(page: PageReading): PageQualityFlags {
  const text = page.text || '';
  const trimmed = text.trim();
  const lineCount = page.blocks?.length || trimmed.split(/\r?\n/).filter(l => l.trim().length > 0).length;

  if (trimmed.length < 20) {
    return {
      quality_score: 0,
      is_low_signal: true,
      is_noisy: false,
      looks_like_cover: false,
    };
  }

  const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return { quality_score: 0, is_low_signal: true, is_noisy: false, looks_like_cover: false };
  }

  const avgLen = tokens.reduce((s, t) => s + t.length, 0) / tokens.length;
  const shortTokens = tokens.filter(t => t.length <= 2).length;
  const shortRatio = shortTokens / tokens.length;
  const meaningful = (trimmed.match(/[\p{L}\p{N}]/gu) || []).length;
  const density = meaningful / trimmed.length;

  // Combine density + avg token length (capped) for a 0..1 score
  const lengthScore = Math.min(avgLen / 6, 1); // tokens of avg length 6+ → full
  const quality_score = Math.max(0, Math.min(1, density * 0.6 + lengthScore * 0.4));

  return {
    quality_score,
    is_low_signal: trimmed.length < 80 || tokens.length < 15,
    is_noisy: shortRatio > 0.5 && avgLen < 3,
    looks_like_cover: lineCount > 0 && lineCount <= 4 && tokens.length >= 4,
  };
}

/**
 * Normalize a page's text by splitting on newlines, trimming each line,
 * and dropping empty lines. Returns the cleaned line array (scale-normalization
 * for text — no canvas needed for born-digital paths).
 */
export function normalizePageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.replace(/[\u00A0\t]+/g, ' ').replace(/ {3,}/g, '   ').trimEnd())
    .filter(l => l.trim().length > 0);
}

/**
 * OPTIONAL grayscale conversion of an HTMLCanvasElement using native
 * Canvas API only. Exposed for future OCR-side use; safe to ignore now.
 * No-op if 2D context is unavailable. In-browser only.
 */
export function canvasToGrayscale(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = g;
  }
  ctx.putImageData(imgData, 0, 0);
}
