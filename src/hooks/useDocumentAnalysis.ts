// ═══════════════════════════════════════════════════════════════
// useDocumentAnalysis — Door 3: Analysis + proposal state
// ═══════════════════════════════════════════════════════════════
// Manages analysis results and proposals for uploaded documents.
// Trial-safe persistence: hydrates from + writes to Supabase
// (compact 2-table schema). Promoted state derived from
// proposal status. No outbound document-content path.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type {
  ExtractionProposal,
  ProposalStatus,
} from '@/features/documents/extraction-proposal-model';
import { createProposal } from '@/features/documents/extraction-proposal-model';
import { analyzeDocument, type AnalysisResult, type EngineStageEvent } from '@/features/documents/analysis-engine';
import type { ReadingArtifact } from '@/features/documents/reading-artifact-model';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import type { DocumentSlotType } from '@/features/documents/document-registry-model';
import {
  hydrateEngineStateForUser,
  persistAnalysis,
  persistProposals,
  persistProposalStatus,
  persistProposalValue,
  persistManualProposal,
  deletePersistedDocument,
  deleteAllPersistedForUser,
  type PersistedArtifactSummary,
  type PersistedStructuredArtifactSummary,
} from '@/features/documents/engine-persistence';

interface UseDocumentAnalysisOptions {
  studentId: string | null;
  canonicalFile: CanonicalStudentFile | null;
}

export interface PromotedField {
  fieldKey: string;
  value: string;
  proposalId: string;
  documentId: string;
  source: 'auto_accepted' | 'manual_accepted';
}

/** Hydrated artifact summary surface — visible truth after reload. */
export interface HydratedArtifactSurface {
  documentId: string;
  documentFilename: string | null;
  artifactSummary: PersistedArtifactSummary | null;
  structuredArtifactSummary: PersistedStructuredArtifactSummary | null;
}

/** Live activity surface — one stage event per document, replaced as the
 *  engine progresses. UI reads it to show "what is the engine doing right
 *  now". Cleared automatically when the document completes/fails. */
export interface LiveStageState {
  documentId: string;
  filename: string;
  stage: EngineStageEvent['stage'];
  detail: string | null;
  elapsed_ms: number;
  updated_at: number;
}

interface UseDocumentAnalysisResult {
  analyses: DocumentAnalysis[];
  proposals: ExtractionProposal[];
  promotedFields: PromotedField[];
  artifacts: Record<string, ReadingArtifact>;
  hydratedArtifactSurfaces: Record<string, HydratedArtifactSurface>;
  isAnalyzing: boolean;
  /** Per-document live engine activity (stage + friendly detail). */
  liveStages: Record<string, LiveStageState>;
  analyzeFile: (file: File, documentId: string, slotHint: DocumentSlotType | null) => Promise<AnalysisResult | null>;
  acceptProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;
  removePromotedField: (proposalId: string) => void;
  removePromotedFieldsForDocument: (documentId: string) => void;
  reanalyzeFile: (documentId: string) => Promise<AnalysisResult | null>;
  getProposalsForDocument: (documentId: string) => ExtractionProposal[];
  getAnalysis: (documentId: string) => DocumentAnalysis | undefined;
  dismissAnalysis: (documentId: string) => void;
  clearAllAnalyses: () => void;
  /** Inline-edit a field value for a document (creates proposal if missing). Always sets pending_review. */
  editFieldValue: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}

function laneFromClassification(c: string | null | undefined): 'passport' | 'transcript' | 'graduation' | 'language' | 'unknown' {
  if (c === 'passport') return 'passport';
  if (c === 'transcript') return 'transcript';
  if (c === 'graduation_certificate') return 'graduation';
  if (c === 'language_certificate') return 'language';
  return 'unknown';
}

/**
 * Derive promoted fields from proposals + provenance map.
 * Honest provenance: a proposal accepted by the user is `manual_accepted`;
 * an engine-auto-accepted proposal is `auto_accepted`. Reload-safe.
 */
function derivePromotedFromProposals(
  proposals: ExtractionProposal[],
  manualAcceptedIds: Set<string>,
): PromotedField[] {
  return proposals
    .filter(p => p.proposal_status === 'auto_accepted' && p.proposed_value != null)
    .map(p => ({
      fieldKey: p.field_key,
      value: p.proposed_value!,
      proposalId: p.proposal_id,
      documentId: p.document_id,
      source: manualAcceptedIds.has(p.proposal_id) ? 'manual_accepted' as const : 'auto_accepted' as const,
    }));
}

export function useDocumentAnalysis({
  studentId,
  canonicalFile,
}: UseDocumentAnalysisOptions): UseDocumentAnalysisResult {
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [proposals, setProposals] = useState<ExtractionProposal[]>([]);
  const [promotedFields, setPromotedFields] = useState<PromotedField[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, ReadingArtifact>>({});
  const [hydratedArtifactSurfaces, setHydratedArtifactSurfaces] = useState<Record<string, HydratedArtifactSurface>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzingCount = useRef(0);
  const fileCache = useRef(new Map<string, { file: File; slotHint: DocumentSlotType | null }>());
  /** Track manual_accepted proposals so derivation distinguishes user vs engine. */
  const manualAcceptedRef = useRef<Set<string>>(new Set());
  const hydratedFor = useRef<string | null>(null);

  // ── Hydrate persisted engine state on mount / on user change ──
  useEffect(() => {
    if (!studentId) return;
    if (hydratedFor.current === studentId) return;
    hydratedFor.current = studentId;
    let cancelled = false;
    (async () => {
      const { analyses: ha, proposals: hp, analysis_extras, proposal_decisions } = await hydrateEngineStateForUser(studentId);
      if (cancelled) return;
      manualAcceptedRef.current = new Set(
        proposal_decisions.filter(d => d.decided_by === 'user').map(d => d.proposal_id),
      );
      setAnalyses(ha);
      setProposals(hp);
      setPromotedFields(derivePromotedFromProposals(hp, manualAcceptedRef.current));
      const surfaces: Record<string, HydratedArtifactSurface> = {};
      for (const ex of analysis_extras) {
        surfaces[ex.document_id] = {
          documentId: ex.document_id,
          documentFilename: ex.document_filename,
          artifactSummary: ex.artifact_summary,
          structuredArtifactSummary: ex.structured_artifact_summary,
        };
      }
      setHydratedArtifactSurfaces(surfaces);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const analyzeFile = useCallback(async (
    file: File,
    documentId: string,
    slotHint: DocumentSlotType | null,
  ): Promise<AnalysisResult | null> => {
    if (!studentId) return null;

    fileCache.current.set(documentId, { file, slotHint });

    analyzingCount.current++;
    setIsAnalyzing(true);

    try {
      const result = await analyzeDocument({
        file,
        documentId,
        studentId,
        slotHint,
        canonicalFile,
      });

      setAnalyses(prev => {
        const existing = prev.findIndex(a => a.document_id === documentId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result.analysis;
          return updated;
        }
        return [...prev, result.analysis];
      });

      setProposals(prev => {
        const filtered = prev.filter(p => p.document_id !== documentId);
        return [...filtered, ...result.proposals];
      });

      setArtifacts(prev => ({ ...prev, [documentId]: result.artifact }));

      // Promoted state is DERIVED from proposal status (auto_accepted).
      const newPromoted = derivePromotedFromProposals(result.proposals, manualAcceptedRef.current);
      if (newPromoted.length > 0) {
        setPromotedFields(prev => {
          const filtered = prev.filter(pf => pf.documentId !== documentId);
          return [...filtered, ...newPromoted];
        });
      }

      // ── Persist (trial-safe) ────────────────────────────────
      const lane = laneFromClassification(result.analysis.classification_result);
      await Promise.all([
        persistAnalysis({
          userId: studentId,
          analysis: result.analysis,
          documentFilename: file.name,
          artifact: result.artifact,
          structuredArtifact: result.structured_artifact,
        }),
        persistProposals({
          userId: studentId,
          documentId,
          proposals: result.proposals,
          sourceLane: lane,
        }),
      ]);

      return result;
    } finally {
      analyzingCount.current--;
      if (analyzingCount.current === 0) setIsAnalyzing(false);
    }
  }, [studentId, canonicalFile]);

  const reanalyzeFile = useCallback(async (documentId: string) => {
    const cached = fileCache.current.get(documentId);
    if (!cached) {
      console.warn('[Door1:Reanalyze] No cached file for', documentId);
      return null;
    }
    setPromotedFields(prev => prev.filter(pf => pf.documentId !== documentId));
    setProposals(prev => prev.filter(p => p.document_id !== documentId));
    return analyzeFile(cached.file, documentId, cached.slotHint);
  }, [analyzeFile]);

  const acceptProposal = useCallback((proposalId: string) => {
    if (!studentId) return;
    let target: ExtractionProposal | undefined;
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      target = p;
      return { ...p, proposal_status: 'auto_accepted' as ProposalStatus, requires_review: false, auto_apply_candidate: true, updated_at: new Date().toISOString() };
    }));

    if (target && target.proposed_value) {
      manualAcceptedRef.current.add(proposalId);
      setPromotedFields(pf => [...pf.filter(x => x.proposalId !== proposalId), {
        fieldKey: target!.field_key,
        value: target!.proposed_value!,
        proposalId: target!.proposal_id,
        documentId: target!.document_id,
        source: 'manual_accepted' as const,
      }]);
    }

    void persistProposalStatus({
      userId: studentId,
      proposalId,
      status: 'auto_accepted',
      requiresReview: false,
      autoApplyCandidate: true,
      decidedBy: 'user',
    });
  }, [studentId]);

  const rejectProposal = useCallback((proposalId: string) => {
    if (!studentId) return;
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      return { ...p, proposal_status: 'rejected' as ProposalStatus, updated_at: new Date().toISOString() };
    }));
    void persistProposalStatus({
      userId: studentId,
      proposalId,
      status: 'rejected',
      requiresReview: false,
      autoApplyCandidate: false,
      decidedBy: 'user',
    });
  }, [studentId]);

  const getProposalsForDocument = useCallback((documentId: string) => {
    return proposals.filter(p => p.document_id === documentId);
  }, [proposals]);

  const getAnalysis = useCallback((documentId: string) => {
    return analyses.find(a => a.document_id === documentId);
  }, [analyses]);

  const dismissAnalysis = useCallback((documentId: string) => {
    setAnalyses(prev => prev.filter(a => a.document_id !== documentId));
    setProposals(prev => prev.filter(p => p.document_id !== documentId));
    setPromotedFields(prev => prev.filter(pf => pf.documentId !== documentId));
    setArtifacts(prev => {
      const { [documentId]: _, ...rest } = prev;
      return rest;
    });
    setHydratedArtifactSurfaces(prev => {
      const { [documentId]: _s, ...rest } = prev;
      return rest;
    });
    if (studentId) {
      void deletePersistedDocument({ userId: studentId, documentId });
    }
  }, [studentId]);

  const removePromotedField = useCallback((proposalId: string) => {
    if (!studentId) return;
    setPromotedFields(prev => prev.filter(pf => pf.proposalId !== proposalId));
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      return { ...p, proposal_status: 'pending_review' as ProposalStatus, requires_review: true, auto_apply_candidate: false, updated_at: new Date().toISOString() };
    }));
    void persistProposalStatus({
      userId: studentId,
      proposalId,
      status: 'pending_review',
      requiresReview: true,
      autoApplyCandidate: false,
      decidedBy: 'user',
    });
  }, [studentId]);

  const removePromotedFieldsForDocument = useCallback((documentId: string) => {
    if (!studentId) return;
    const toRemove = promotedFields.filter(pf => pf.documentId === documentId).map(pf => pf.proposalId);
    setPromotedFields(prev => prev.filter(pf => pf.documentId !== documentId));
    setProposals(prev => prev.map(p => {
      if (!toRemove.includes(p.proposal_id)) return p;
      return { ...p, proposal_status: 'pending_review' as ProposalStatus, requires_review: true, auto_apply_candidate: false, updated_at: new Date().toISOString() };
    }));
    toRemove.forEach(pid => {
      void persistProposalStatus({
        userId: studentId,
        proposalId: pid,
        status: 'pending_review',
        requiresReview: true,
        autoApplyCandidate: false,
        decidedBy: 'user',
      });
    });
  }, [promotedFields, studentId]);

  const clearAllAnalyses = useCallback(() => {
    setAnalyses([]);
    setProposals([]);
    setPromotedFields([]);
    setArtifacts({});
    setHydratedArtifactSurfaces({});
    manualAcceptedRef.current = new Set();
    if (studentId) {
      void deleteAllPersistedForUser(studentId);
    }
  }, [studentId]);

  /**
   * Inline edit by the student. Always reverts the field to `pending_review`
   * (per UX decision: edited values need staff review before becoming truth).
   * If a proposal exists → updates its value. Otherwise creates a manual proposal.
   * Also removes any prior promoted state for this proposal so the field shows
   * as pending in the assembly view.
   */
  const editFieldValue = useCallback((params: {
    documentId: string;
    fieldKey: string;
    newValue: string;
  }) => {
    if (!studentId) return;
    const { documentId, fieldKey, newValue } = params;
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();

    const existing = proposals.find(
      p => p.document_id === documentId && p.field_key === fieldKey,
    );

    if (existing) {
      // Update existing proposal in state
      setProposals(prev => prev.map(p => {
        if (p.proposal_id !== existing.proposal_id) return p;
        return {
          ...p,
          proposed_value: trimmed,
          normalized_value: trimmed,
          proposal_status: 'pending_review' as ProposalStatus,
          requires_review: true,
          auto_apply_candidate: false,
          updated_at: now,
        };
      }));
      // Drop any promoted entry for this proposal — it becomes pending again
      setPromotedFields(prev => prev.filter(pf => pf.proposalId !== existing.proposal_id));
      manualAcceptedRef.current.delete(existing.proposal_id);
      void persistProposalValue({
        userId: studentId,
        proposalId: existing.proposal_id,
        newValue: trimmed,
      });
    } else {
      // Brand-new manual proposal for previously empty field
      const created = createProposal({
        studentId,
        documentId,
        fieldKey,
        proposedValue: trimmed,
        normalizedValue: trimmed,
        confidence: 1.0,
        conflictWithCurrent: false,
      });
      created.proposal_status = 'pending_review';
      created.requires_review = true;
      created.auto_apply_candidate = false;
      setProposals(prev => [...prev, created]);
      const lane = (() => {
        if (fieldKey.startsWith('identity.')) return 'passport' as const;
        if (fieldKey.startsWith('language.')) return 'language' as const;
        if (fieldKey.startsWith('academic.')) return 'transcript' as const;
        return 'unknown' as const;
      })();
      void persistManualProposal({
        userId: studentId,
        documentId,
        proposal: created,
        sourceLane: lane,
      });
    }
  }, [studentId, proposals]);

  return {
    analyses,
    proposals,
    promotedFields,
    artifacts,
    hydratedArtifactSurfaces,
    isAnalyzing,
    analyzeFile,
    reanalyzeFile,
    acceptProposal,
    rejectProposal,
    removePromotedField,
    removePromotedFieldsForDocument,
    getProposalsForDocument,
    getAnalysis,
    dismissAnalysis,
    clearAllAnalyses,
    editFieldValue,
  };
}
