// ═══════════════════════════════════════════════════════════════
// useStudentEvaluation
// ───────────────────────────────────────────────────────────────
// Phase A persistence hook for the student evaluation workspace.
//
//  • Loads persisted normalized credentials + snapshot from Supabase.
//  • Recomputes ONLY when input_hash or rules_version changes.
//  • Upserts results so nothing is lost on navigation/refresh.
//
// Triggers a recompute when:
//   - a document is added / removed / replaced
//   - the engine's rules_version is bumped
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  NORMALIZER_VERSION,
  sourceNormalizer,
} from '@/features/source-normalization/engine';
import type {
  NormalizerInput,
  SourceCountryCode,
} from '@/features/source-normalization/types';
import { computeInputHash } from '@/features/evaluation-snapshot/hash';
import { buildEvaluationSnapshot } from '@/features/evaluation-snapshot/aggregator';
import type {
  EvaluationSnapshotResult,
  PersistedEvaluationSnapshot,
  PersistedNormalizedCredential,
  RecomputeReason,
} from '@/features/evaluation-snapshot/types';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';

// ─── Inputs from the page ────────────────────────────────────

export interface EvaluationDocInput {
  /** CRM document id (matches analysis.document_id). */
  document_id: string;
  /** ISO-2 source country if known. */
  source_country: SourceCountryCode | null;
  /** Raw award name as extracted (Arabic or English). */
  award_name_raw: string;
  award_year: number | null;
  award_grade_raw: string | null;
  award_score_raw: string | null;
  /** Stable content fingerprint (file bytes hash, or analysis updated_at as fallback). */
  content_hash: string | null;
}

interface UseStudentEvaluationOptions {
  userId: string | null;
  docs: EvaluationDocInput[];
  /** Disable while initial data is still loading to avoid wiping on empty input. */
  enabled?: boolean;
}

interface UseStudentEvaluationReturn {
  loading: boolean;
  computing: boolean;
  saved: boolean;
  /** All persisted credentials, keyed by document_id. */
  credentialsByDocId: Record<string, PersistedNormalizedCredential>;
  snapshot: PersistedEvaluationSnapshot | null;
  snapshotResult: EvaluationSnapshotResult | null;
  lastComputedAt: string | null;
  recomputeReason: RecomputeReason | string | null;
  /** True if the in-memory hash matches the persisted snapshot. */
  isUpToDate: boolean;
  /** Force a recompute regardless of hash (e.g. after rules version bump). */
  recompute: () => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────

function diffReason(
  prev: PersistedEvaluationSnapshot | null,
  nextDocIds: string[],
): RecomputeReason {
  if (!prev) return 'first_compute';
  if (prev.rules_version !== NORMALIZER_VERSION) return 'rules_version_bump';
  const prevSet = new Set(prev.document_ids);
  const nextSet = new Set(nextDocIds);
  const added = nextDocIds.filter((id) => !prevSet.has(id));
  const removed = prev.document_ids.filter((id) => !nextSet.has(id));
  if (added.length > 0 && removed.length > 0) return 'document_replaced';
  if (added.length > 0) return 'document_added';
  if (removed.length > 0) return 'document_removed';
  return 'manual';
}

function toNormalizerInput(
  userId: string,
  doc: EvaluationDocInput,
): NormalizerInput | null {
  if (!doc.source_country) return null;
  return {
    student_user_id: userId,
    source_country_code: doc.source_country,
    award_name_raw: doc.award_name_raw ?? '',
    award_year: doc.award_year ?? undefined,
    award_grade_raw: doc.award_grade_raw ?? undefined,
    award_score_raw: doc.award_score_raw ?? undefined,
  };
}

// ─── Hook ──────────────────────────────────────────────────

export function useStudentEvaluation({
  userId,
  docs,
  enabled = true,
}: UseStudentEvaluationOptions): UseStudentEvaluationReturn {
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [credentialsByDocId, setCredentialsByDocId] = useState<
    Record<string, PersistedNormalizedCredential>
  >({});
  const [snapshot, setSnapshot] = useState<PersistedEvaluationSnapshot | null>(null);
  const [currentInputHash, setCurrentInputHash] = useState<string | null>(null);

  // Ref to avoid race when inputs change mid-recompute.
  const lastRecomputedHashRef = useRef<string | null>(null);

  // ─── 1. Initial load: pull persisted credentials + snapshot ───
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const [credRes, snapRes] = await Promise.all([
        (supabase as any)
          .from('student_normalized_credentials')
          .select('*')
          .eq('user_id', userId),
        (supabase as any)
          .from('student_evaluation_snapshots')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const credsMap: Record<string, PersistedNormalizedCredential> = {};
      for (const row of credRes.data ?? []) {
        credsMap[row.document_id] = {
          document_id: row.document_id,
          source_country: row.source_country,
          normalized_credential_kind: row.normalized_credential_kind,
          normalized_credential_subtype: row.normalized_credential_subtype ?? undefined,
          normalized_grade_pct: row.normalized_grade_pct,
          award_year: row.award_year,
          matched_rule_ids: Array.isArray(row.matched_rule_ids) ? row.matched_rule_ids : [],
          decisions: Array.isArray(row.decisions) ? row.decisions : [],
          needs_manual_review: !!row.needs_manual_review,
          rules_version: row.rules_version,
          content_hash: row.content_hash,
          updated_at: row.updated_at,
        };
      }
      setCredentialsByDocId(credsMap);

      if (snapRes.data) {
        setSnapshot({
          user_id: snapRes.data.user_id,
          input_hash: snapRes.data.input_hash,
          rules_version: snapRes.data.rules_version,
          document_ids: Array.isArray(snapRes.data.document_ids)
            ? snapRes.data.document_ids
            : [],
          result: snapRes.data.result,
          needs_manual_review: !!snapRes.data.needs_manual_review,
          last_computed_at: snapRes.data.last_computed_at,
          recompute_reason: snapRes.data.recompute_reason ?? null,
        });
        lastRecomputedHashRef.current = snapRes.data.input_hash;
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  // ─── 2. Compute current input hash (cheap, async) ────────────
  useEffect(() => {
    let cancelled = false;
    void computeInputHash(
      docs.map((d) => ({ document_id: d.document_id, content_hash: d.content_hash })),
      NORMALIZER_VERSION,
    ).then((h) => {
      if (!cancelled) setCurrentInputHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [docs]);

  // ─── 3. Recompute only when hash drift detected ──────────────
  const runRecompute = useCallback(
    async (forced = false) => {
      if (!userId || loading || computing) return;
      if (!currentInputHash) return;
      if (!forced && currentInputHash === lastRecomputedHashRef.current) return;

      setComputing(true);
      try {
        const docIds = docs.map((d) => d.document_id);
        const reason = diffReason(snapshot, docIds);

        // Run normalizer per doc.
        const credentials: PersistedNormalizedCredential[] = [];
        for (const doc of docs) {
          const ni = toNormalizerInput(userId, doc);
          if (!ni) {
            credentials.push({
              document_id: doc.document_id,
              source_country: doc.source_country,
              normalized_credential_kind: 'unknown',
              normalized_grade_pct: null,
              award_year: doc.award_year,
              matched_rule_ids: [],
              decisions: [
                {
                  decision_kind: 'review_flag',
                  reason_code: 'country_profile_missing',
                  params: { reason: 'source_country_unknown' },
                  evidence_ids: [],
                },
              ],
              needs_manual_review: true,
              rules_version: NORMALIZER_VERSION,
              content_hash: doc.content_hash,
            });
            continue;
          }
          const out = sourceNormalizer.normalize(ni);
          credentials.push({
            document_id: doc.document_id,
            source_country: doc.source_country,
            normalized_credential_kind: out.normalized_credential_kind,
            normalized_credential_subtype: out.normalized_credential_subtype,
            normalized_grade_pct: out.normalized_grade_pct,
            award_year: doc.award_year,
            matched_rule_ids: out.matched_rule_ids,
            decisions: out.decisions,
            needs_manual_review: out.needs_manual_review,
            rules_version: NORMALIZER_VERSION,
            content_hash: doc.content_hash,
            raw_input: ni,
            raw_output: out,
          });
        }

        // Persist credentials (replace-set: delete any not in current docs).
        const credRows = credentials.map((c) => ({
          user_id: userId,
          document_id: c.document_id,
          source_country: c.source_country,
          normalized_credential_kind: c.normalized_credential_kind,
          normalized_credential_subtype: c.normalized_credential_subtype ?? null,
          normalized_grade_pct: c.normalized_grade_pct,
          award_year: c.award_year,
          matched_rule_ids: c.matched_rule_ids,
          decisions: c.decisions,
          needs_manual_review: c.needs_manual_review,
          rules_version: c.rules_version,
          content_hash: c.content_hash,
          raw_input: c.raw_input ?? null,
          raw_output: c.raw_output ?? null,
        }));

        if (credRows.length > 0) {
          await (supabase as any)
            .from('student_normalized_credentials')
            .upsert(credRows, { onConflict: 'user_id,document_id' });
        }
        // Drop credentials for docs that no longer exist.
        const keepIds = new Set(docIds);
        const stale = Object.keys(credentialsByDocId).filter((id) => !keepIds.has(id));
        if (stale.length > 0) {
          await (supabase as any)
            .from('student_normalized_credentials')
            .delete()
            .eq('user_id', userId)
            .in('document_id', stale);
        }

        // Build + persist snapshot.
        const result = buildEvaluationSnapshot(credentials);
        const needsReview = result.documents_needing_review > 0 || result.documents_evaluated === 0;
        const nowIso = new Date().toISOString();

        const snapRow = {
          user_id: userId,
          input_hash: currentInputHash,
          rules_version: NORMALIZER_VERSION,
          document_ids: docIds,
          result,
          needs_manual_review: needsReview,
          last_computed_at: nowIso,
          recompute_reason: reason,
        };

        await (supabase as any)
          .from('student_evaluation_snapshots')
          .upsert(snapRow, { onConflict: 'user_id' });

        // Update local state.
        const credsMap: Record<string, PersistedNormalizedCredential> = {};
        for (const c of credentials) credsMap[c.document_id] = c;
        setCredentialsByDocId(credsMap);
        setSnapshot({
          user_id: userId,
          input_hash: currentInputHash,
          rules_version: NORMALIZER_VERSION,
          document_ids: docIds,
          result,
          needs_manual_review: needsReview,
          last_computed_at: nowIso,
          recompute_reason: reason,
        });
        lastRecomputedHashRef.current = currentInputHash;

        if (import.meta.env.DEV) {
          console.log('[useStudentEvaluation] recomputed', {
            reason,
            docs: docIds.length,
            needsReview,
          });
        }
      } catch (err) {
        console.error('[useStudentEvaluation] recompute failed', err);
      } finally {
        setComputing(false);
      }
    },
    [userId, loading, computing, currentInputHash, docs, snapshot, credentialsByDocId],
  );

  // Auto-trigger recompute when drift detected.
  useEffect(() => {
    if (!enabled || loading) return;
    if (!currentInputHash) return;
    if (currentInputHash === lastRecomputedHashRef.current) return;
    // Skip the first-compute when there are zero docs and no prior snapshot.
    if (docs.length === 0 && !snapshot) {
      lastRecomputedHashRef.current = currentInputHash;
      return;
    }
    void runRecompute(false);
  }, [enabled, loading, currentInputHash, runRecompute, docs.length, snapshot]);

  const isUpToDate = useMemo(
    () => !!currentInputHash && currentInputHash === lastRecomputedHashRef.current,
    [currentInputHash, snapshot?.input_hash],
  );

  return {
    loading,
    computing,
    saved: !!snapshot && isUpToDate,
    credentialsByDocId,
    snapshot,
    snapshotResult: snapshot?.result ?? null,
    lastComputedAt: snapshot?.last_computed_at ?? null,
    recomputeReason: snapshot?.recompute_reason ?? null,
    isUpToDate,
    recompute: () => runRecompute(true),
  };
}
