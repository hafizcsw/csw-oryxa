/**
 * Robust relative-time formatter for notifications.
 *
 * - Normalizes ISO strings missing a timezone (assumes UTC).
 * - Handles future timestamps (server clock drift) gracefully.
 * - Outputs Arabic forms when locale starts with 'ar', English otherwise.
 */
function normalizeIso(input: string): number {
  if (!input) return Date.now();
  let s = input.trim();
  // If the string looks like ISO without a timezone marker, treat it as UTC.
  // Matches: 2026-04-22T12:34:56  or  2026-04-22T12:34:56.789  (no Z, no +HH:MM)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s + 'Z';
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

export function relativeTime(iso: string, locale: string): string {
  const t = normalizeIso(iso);
  const now = Date.now();
  // Future timestamps → clamp to "now"
  const diffSec = Math.max(0, Math.round((now - t) / 1000));

  const ar = (locale || '').toLowerCase().startsWith('ar');

  if (diffSec < 45) return ar ? 'الآن' : 'now';

  const min = Math.round(diffSec / 60);
  if (min < 60) return ar ? `منذ ${min} د` : `${min}m`;

  const hr = Math.round(min / 60);
  if (hr < 24) return ar ? `منذ ${hr} س` : `${hr}h`;

  const day = Math.round(hr / 24);
  if (day < 7) return ar ? `منذ ${day} ي` : `${day}d`;

  const wk = Math.round(day / 7);
  if (wk < 5) return ar ? `منذ ${wk} أ` : `${wk}w`;

  const mo = Math.round(day / 30);
  if (mo < 12) return ar ? `منذ ${mo} ش` : `${mo}mo`;

  const yr = Math.round(day / 365);
  return ar ? `منذ ${yr} سنة` : `${yr}y`;
}
