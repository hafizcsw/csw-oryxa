// ═══════════════════════════════════════════════════════════════
// Phase A — Round 2: Hook behavior tests (Sessions A / B / C)
// ───────────────────────────────────────────────────────────────
// Pure logic proof — no real DB. Mocks supabase to verify:
//   Session A: first compute → edge fn called once
//   Session B: reload (same input_hash) → no recompute
//   Session C: doc changed (different input_hash) → recompute once
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mock supabase BEFORE importing the hook (hoisted-safe) ──
vi.mock('@/integrations/supabase/client', () => {
  const invokeMock = vi.fn();
  const credSelectChain = { eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
  const snapSelectChain = { eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
  const authSubscription = { unsubscribe: vi.fn() };
  const getSessionMock = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
  const onAuthStateChangeMock = vi.fn().mockReturnValue({ data: { subscription: authSubscription } });
  (globalThis as any).__phaseAMocks = { invokeMock, credSelectChain, snapSelectChain, getSessionMock, onAuthStateChangeMock, authSubscription };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => (table === 'student_evaluation_snapshots' ? snapSelectChain : credSelectChain),
      }),
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: onAuthStateChangeMock,
      },
      functions: { invoke: invokeMock },
    },
  };
});

const { invokeMock, credSelectChain, snapSelectChain, getSessionMock, onAuthStateChangeMock, authSubscription } = (globalThis as any).__phaseAMocks;

import { useStudentEvaluation, type EvaluationDocInput } from '@/hooks/useStudentEvaluation';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeDoc(id: string, hash: string, country: 'EG' | 'AE' | 'JO' = 'EG'): EvaluationDocInput {
  return {
    document_id: id,
    source_country: country,
    award_name_raw: 'الثانوية العامة',
    award_year: 2024,
    award_grade_raw: null,
    award_score_raw: '380/410',
    content_hash: hash,
    award_track_raw: 'علمي',
  };
}

function mockEdgeResponse(reason: string, docs: EvaluationDocInput[], inputHash: string) {
  return {
    data: {
      ok: true,
      recompute_reason: reason,
      skipped: false,
      snapshot: {
        student_user_id: USER_ID,
        input_hash: inputHash,
        rules_version: 'phase-a.logic.0.1',
        document_ids: docs.map(d => d.document_id),
        result: {
          documents_evaluated: docs.length,
          documents_passing: docs.length,
          documents_needing_review: 0,
          per_document: docs.map(d => ({ document_id: d.document_id, summary: 'thanaweya_amma · 92.68%', needs_manual_review: false, reason_codes: [] })),
          headline_credential: docs[0] ? { document_id: docs[0].document_id, kind: 'secondary_general', subtype: 'thanaweya_amma', grade_pct: 92.68, source_country: 'EG' } : null,
        },
        needs_manual_review: false,
        last_computed_at: new Date().toISOString(),
        recompute_reason: reason,
      },
      credentials: docs.map(d => ({
        source_document_id: d.document_id,
        source_country_code: d.source_country,
        normalized_credential_kind: 'secondary_general',
        normalized_credential_subtype: 'thanaweya_amma',
        normalized_grade_pct: 92.68,
        award_year: d.award_year,
        matched_rule_ids: ['EG.rule.thanaweya_amma'],
        decisions: [{ decision_kind: 'pattern_match', reason_code: 'pattern_matched', params: {}, evidence_ids: [] }],
        needs_manual_review: false,
        normalizer_version: 'phase-a.logic.0.1',
        content_hash: d.content_hash,
      })),
    },
    error: null,
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  getSessionMock.mockReset().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null });
  onAuthStateChangeMock.mockReset().mockReturnValue({ data: { subscription: authSubscription } });
  credSelectChain.eq.mockReset().mockResolvedValue({ data: [], error: null });
  snapSelectChain.eq.mockReset().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) });
});

describe('useStudentEvaluation — Phase A Round 2 wiring', () => {
  it('Session A: first compute triggers exactly one edge fn call', async () => {
    const docs = [makeDoc('doc-1', 'hash-v1')];
    invokeMock.mockResolvedValue(mockEdgeResponse('first_compute', docs, 'h-A'));

    const { result } = renderHook(() => useStudentEvaluation({ userId: USER_ID, docs }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    expect(invokeMock).toHaveBeenCalledWith('phase-a-normalize', expect.objectContaining({
      body: expect.objectContaining({ docs, force: false }),
    }));
    expect(result.current.snapshot?.recompute_reason).toBe('first_compute');
    expect(result.current.snapshot?.result.documents_evaluated).toBe(1);
  });

  it('Session B: reload with same input_hash → no recompute', async () => {
    const docs = [makeDoc('doc-1', 'hash-v1')];
    // Initial load returns the existing snapshot — no edge fn call expected.
    snapSelectChain.eq.mockReturnValue({
      order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({
        data: {
          student_user_id: USER_ID,
          input_hash: 'PRECOMPUTED', // will be overwritten below
          rules_version: 'phase-a.logic.0.1',
          document_ids: ['doc-1'],
          result: { documents_evaluated: 1, documents_passing: 1, documents_needing_review: 0, per_document: [], headline_credential: null },
          needs_manual_review: false,
          last_computed_at: new Date().toISOString(),
          recompute_reason: 'first_compute',
        },
        error: null,
      }) }) }),
    });
    credSelectChain.eq.mockResolvedValue({
      data: [{
        source_document_id: 'doc-1',
        source_country_code: 'EG',
        normalized_credential_kind: 'secondary_general',
        normalized_credential_subtype: 'thanaweya_amma',
        normalized_grade_pct: 92.68,
        award_year: 2024,
        matched_rule_ids: ['EG.rule.thanaweya_amma'],
        decisions: [],
        needs_manual_review: false,
        normalizer_version: 'phase-a.logic.0.1',
        content_hash: 'hash-v1',
      }],
      error: null,
    });

    // Compute the input_hash the hook will compute and inject it as the "stored" hash.
    const { computeInputHash } = await import('@/features/evaluation-snapshot/hash');
    const expectedHash = await computeInputHash(
      docs.map(d => ({ document_id: d.document_id, content_hash: d.content_hash })),
      'phase-a.logic.0.1',
    );
    snapSelectChain.eq.mockReturnValue({
      order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({
        data: {
          student_user_id: USER_ID,
          input_hash: expectedHash,
          rules_version: 'phase-a.logic.0.1',
          document_ids: ['doc-1'],
          result: { documents_evaluated: 1, documents_passing: 1, documents_needing_review: 0, per_document: [], headline_credential: null },
          needs_manual_review: false,
          last_computed_at: new Date().toISOString(),
          recompute_reason: 'first_compute',
        },
        error: null,
      }) }) }),
    });

    const { result } = renderHook(() => useStudentEvaluation({ userId: USER_ID, docs }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.isUpToDate).toBe(true));

    // Give any potential drift effect a chance to run.
    await new Promise(r => setTimeout(r, 50));

    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.saved).toBe(true);
  });

  it('Session C: input changes (new doc) → exactly one recompute call', async () => {
    const v1 = [makeDoc('doc-1', 'hash-v1')];
    const v2 = [makeDoc('doc-1', 'hash-v1'), makeDoc('doc-2', 'hash-v2', 'AE')];

    let callCount = 0;
    invokeMock.mockImplementation((_name: string, opts: any) => {
      callCount++;
      const docsArg = opts?.body?.docs ?? [];
      if (callCount === 1) return Promise.resolve(mockEdgeResponse('first_compute', docsArg, 'h-1'));
      return Promise.resolve(mockEdgeResponse('document_added', docsArg, 'h-2'));
    });

    const { result, rerender } = renderHook(
      ({ docs }: { docs: EvaluationDocInput[] }) => useStudentEvaluation({ userId: USER_ID, docs }),
      { initialProps: { docs: v1 } },
    );

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    rerender({ docs: v2 });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(result.current.snapshot?.recompute_reason).toBe('document_added');
  });
});
