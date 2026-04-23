// ═══════════════════════════════════════════════════════════════
// Stable input hash for evaluation snapshots.
// Hash = sha256( sorted(document_ids + content_hashes) + rules_version )
// Same inputs → same hash → no recompute needed.
// ═══════════════════════════════════════════════════════════════

export interface DocumentHashInput {
  document_id: string;
  /** Optional content hash — if null we still hash the id so add/remove still triggers recompute. */
  content_hash?: string | null;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback for non-secure contexts: deterministic but weaker.
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return `fallback_${(h >>> 0).toString(16)}_${text.length}`;
  }
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeInputHash(
  docs: DocumentHashInput[],
  rulesVersion: string,
): Promise<string> {
  const sorted = [...docs]
    .map((d) => ({
      document_id: d.document_id,
      content_hash: d.content_hash ?? '',
    }))
    .sort((a, b) =>
      a.document_id < b.document_id ? -1 : a.document_id > b.document_id ? 1 : 0,
    );
  const payload = JSON.stringify({ docs: sorted, rules_version: rulesVersion });
  return sha256Hex(payload);
}
