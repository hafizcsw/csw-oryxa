// ═══════════════════════════════════════════════════════════════
// useStudentEvaluation — Phase A Round 2: Wired to OFFICIAL tables
// ───────────────────────────────────────────────────────────────
// Reads from:
//   • student_credential_normalized   (per-doc truth)
//   • student_evaluation_snapshots    (aggregate snapshot)
// Writes via edge function `phase-a-normalize` which atomically
// inserts/upserts:
//   student_award_raw → student_credential_normalized
//   → credential_mapping_decision_log → student_evaluation_snapshots
//
// Recompute policy (proven by scripted runtime sessions A/B/C):
//   • First load with no snapshot         → first compute
//   • Same input_hash + same rules_version → no recompute (skip)
//   • input_hash drift (doc add/remove/replace/content change) → recompute
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SourceCountryCode } from '@/features/source-normalization/types';
import { computeInputHash } from '@/features/evaluation-snapshot/hash';
import type {
  EvaluationSnapshotResult,
  PersistedEvaluationSnapshot,
  PersistedNormalizedCredential,
  RecomputeReason,
} from '@/features/evaluation-snapshot/types';

const NORMALIZER_VERSION = 'phase-a.logic.0.1';

export interface EvaluationDocInput {
  document_id: string;
  source_country: SourceCountryCode | null;
  award_name_raw: string;
  award_year: number | null;
  award_grade_raw: string | null;
  award_score_raw: string | null;
  /** Stable content fingerprint (heuristic — analysis updated_at, not file checksum). */
  content_hash: string | null;
  award_track_raw?: string | null;
  award_stream_raw?: string | null;
}

interface UseStudentEvaluationOptions {
  userId: string | null;
  docs: EvaluationDocInput[];
  enabled?: boolean;
}

interface UseStudentEvaluationReturn {
  loading: boolean;
  computing: boolean;
  saved: boolean;
  credentialsByDocId: Record<string, PersistedNormalizedCredential>;
  snapshot: PersistedEvaluationSnapshot | null;
  snapshotResult: EvaluationSnapshotResult | null;
  lastComputedAt: string | null;
  recomputeReason: RecomputeReason | string | null;
  isUpToDate: boolean;
  recompute: () => Promise<void>;
}

function rowToCredential(row: any): PersistedNormalizedCredential {
  return {
    document_id: row.source_document_id,
    source_country: row.source_country_code,
    normalized_credential_kind: row.normalized_credential_kind,
    normalized_credential_subtype: row.normalized_credential_subtype ?? undefined,
    normalized_grade_pct: row.normalized_grade_pct,
    award_year: row.award_year,
    matched_rule_ids: Array.isArray(row.matched_rule_ids) ? row.matched_rule_ids : [],
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    needs_manual_review: !!row.needs_manual_review,
    rules_version: row.normalizer_version,
    content_hash: row.content_hash,
    updated_at: row.updated_at,
  };
}

function rowToSnapshot(row: any): PersistedEvaluationSnapshot {
  return {
    user_id: row.student_user_id,
    input_hash: row.input_hash,
    rules_version: row.rules_version,
    document_ids: Array.isArray(row.document_ids) ? row.document_ids : [],
    result: row.result,
    needs_manual_review: !!row.needs_manual_review,
    last_computed_at: row.last_computed_at,
    recompute_reason: row.recompute_reason ?? null,
  };
}

export function useStudentEvaluation({
  userId,
  docs,
  enabled = true,
}: UseStudentEvaluationOptions): UseStudentEvaluationReturn {
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [credentialsByDocId, setCredentialsByDocId] = useState<Record<string, PersistedNormalizedCredential>>({});
  const [snapshot, setSnapshot] = useState<PersistedEvaluationSnapshot | null>(null);
  const [currentInputHash, setCurrentInputHash] = useState<string | null>(null);

  const lastRecomputedHashRef = useRef<string | null>(null);

  // ─── 1. Initial load: pull from OFFICIAL Phase A tables ─────
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const [credRes, snapRes] = await Promise.all([
        (supabase as any)
          .from('student_credential_normalized')
          .select('*')
          .eq('student_user_id', userId),
        (supabase as any)
          .from('student_evaluation_snapshots')
          .select('*')
          .eq('student_user_id', userId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const credsMap: Record<string, PersistedNormalizedCredential> = {};
      for (const row of credRes.data ?? []) {
        if (!row.source_document_id) continue;
        credsMap[row.source_document_id] = rowToCredential(row);
      }
      setCredentialsByDocId(credsMap);

      if (snapRes.data) {
        const s = rowToSnapshot(snapRes.data);
        setSnapshot(s);
        lastRecomputedHashRef.current = s.input_hash;
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, enabled]);

  // ─── 2. Compute current input hash (cheap, async) ───────────
  useEffect(() => {
    let cancelled = false;
    void computeInputHash(
      docs.map(d => ({ document_id: d.document_id, content_hash: d.content_hash })),
      NORMALIZER_VERSION,
    ).then(h => { if (!cancelled) setCurrentInputHash(h); });
    return () => { cancelled = true; };
  }, [docs]);

  // ─── 3. Recompute via edge function ─────────────────────────
  const runRecompute = useCallback(
    async (forced = false) => {
      if (!userId || loading || computing) return;
      if (!currentInputHash) return;
      if (!forced && currentInputHash === lastRecomputedHashRef.current) return;

      // Claim the hash IMMEDIATELY to prevent re-entry from effect re-runs.
      lastRecomputedHashRef.current = currentInputHash;
      setComputing(true);
      try {
        const { data, error } = await supabase.functions.invoke('phase-a-normalize', {
          body: { docs, input_hash: currentInputHash, force: forced },
        });

        if (error || !data?.ok) {
          console.error('[useStudentEvaluation] edge function failed', error || data);
          return;
        }

        const credsMap: Record<string, PersistedNormalizedCredential> = {};
        for (const row of data.credentials ?? []) {
          if (!row.source_document_id) continue;
          credsMap[row.source_document_id] = rowToCredential(row);
        }
        setCredentialsByDocId(credsMap);
        if (data.snapshot) {
          setSnapshot(rowToSnapshot(data.snapshot));
          lastRecomputedHashRef.current = data.snapshot.input_hash;
        }

        if (import.meta.env.DEV) {
          console.log('[useStudentEvaluation] recomputed via edge fn', {
            reason: data.recompute_reason,
            skipped: data.skipped,
            docs: docs.length,
          });
        }
      } catch (err) {
        console.error('[useStudentEvaluation] recompute failed', err);
      } finally {
        setComputing(false);
      }
    },
    [userId, loading, computing, currentInputHash, docs],
  );

  // Auto-trigger recompute when drift detected.
  // NOTE: runRecompute intentionally NOT in deps — would cause re-entry loop.
  //
  // Persistence rule (critical):
  //   • Existing snapshot must NEVER be overwritten by an empty docs array.
  //     On reload, `docs` starts empty until Door 1 finishes loading. Without
  //     this guard, the engine would wipe a perfectly good snapshot every
  //     refresh. Snapshot is replaced ONLY when the student uploads/changes
  //     a real document (docs.length > 0 with a different input_hash).
  useEffect(() => {
    if (!enabled || loading) return;
    if (!currentInputHash) return;
    if (currentInputHash === lastRecomputedHashRef.current) return;

    // No docs yet: keep existing snapshot visible, do not recompute.
    if (docs.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[useStudentEvaluation] skip recompute — empty docs, preserving snapshot', {
          hasSnapshot: !!snapshot,
        });
      }
      return;
    }

    void runRecompute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, currentInputHash, docs.length]);

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
