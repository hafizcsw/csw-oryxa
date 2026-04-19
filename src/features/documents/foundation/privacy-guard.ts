// ═══════════════════════════════════════════════════════════════
// Foundation — Privacy Guard (official, V1)
// ═══════════════════════════════════════════════════════════════
// Runtime fence that prevents the foundation layer from ever
// shipping raw document bytes to an external provider.
//
// Build-time companion: scripts/check-no-external-doc-path.sh
// (greps for known external doc/OCR/LLM endpoints inside foundation/)
// ═══════════════════════════════════════════════════════════════

const FORBIDDEN_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'api.mistral.ai',
  'generativelanguage.googleapis.com',
  'api.cognitive.microsoft.com',
  'cognitiveservices.azure.com',
  'documentai.googleapis.com',
  'vision.googleapis.com',
  'textract.amazonaws.com',
  'api.deepseek.com',
];

export class PrivacyViolationError extends Error {
  constructor(public readonly target: string, public readonly context: string) {
    super(`[privacy-guard] BLOCKED external raw document path → ${target} (context: ${context})`);
    this.name = 'PrivacyViolationError';
  }
}

/** Throws if `target` is a known external doc/OCR/LLM endpoint. */
export function assertNoExternalRawPath(target: string, context: string): void {
  if (!target) return;
  let host = '';
  try {
    host = new URL(target).host.toLowerCase();
  } catch {
    // not a URL — nothing to enforce here
    return;
  }
  for (const bad of FORBIDDEN_HOSTS) {
    if (host === bad || host.endsWith('.' + bad)) {
      // visible in console + thrown so callers can mark requires_review
      // eslint-disable-next-line no-console
      console.error('[PrivacyGuard] blocked external raw path', { host, context });
      throw new PrivacyViolationError(target, context);
    }
  }
}

/** Wrap an arbitrary async producer so any thrown PrivacyViolationError
 *  becomes a soft signal: `{ blocked: true, reason }`. */
export async function withPrivacyGuard<T>(
  context: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; blocked: true; reason: string }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (e) {
    if (e instanceof PrivacyViolationError) {
      return { ok: false, blocked: true, reason: e.message };
    }
    throw e;
  }
}
