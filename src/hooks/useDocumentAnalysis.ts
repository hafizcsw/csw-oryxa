// ═══════════════════════════════════════════════════════════════
// useDocumentAnalysis — adapter over Mistral truth tables
// ═══════════════════════════════════════════════════════════════
// Keeps the existing UI contract intact, but the source of truth is
// now document_lane_facts + document_review_queue instead of the
// removed legacy multi-engine reader.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { DocumentAnalysis, ParserType } from '@/features/documents/document-analysis-model';
import type { ExtractionProposal } from '@/features/documents/extraction-proposal-model';
import type { ReadingArtifact } from '@/features/documents/reading-artifact-model';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import type { DocumentSlotType } from '@/features/documents/document-registry-model';

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

export interface HydratedArtifactSurface {
  documentId: string;
  documentFilename: string | null;
  artifactSummary: unknown | null;
  structuredArtifactSummary: unknown | null;
}

export interface LiveStageState {
  documentId: string;
  filename: string;
  stage: 'reading' | 'ocr' | 'classifying' | 'mrz' | 'extracting' | 'transcript_rows' | 'building_proposals' | 'completed' | 'failed';
  detail: string | null;
  elapsed_ms: number;
  updated_at: number;
}

export interface AnalysisResult {
  analysis: DocumentAnalysis;
  proposals: ExtractionProposal[];
  artifact: ReadingArtifact | null;
  structured_artifact: unknown | null;
}

interface UseDocumentAnalysisResult {
  analyses: DocumentAnalysis[];
  proposals: ExtractionProposal[];
  promotedFields: PromotedField[];
  artifacts: Record<string, ReadingArtifact>;
  hydratedArtifactSurfaces: Record<string, HydratedArtifactSurface>;
  isAnalyzing: boolean;
  liveStages: Record<string, LiveStageState>;
  analyzeFile: (
    file: File,
    documentId: string,
    slotHint: DocumentSlotType | null,
    storagePath?: string | null,
    crmFileId?: string | null,
  ) => Promise<AnalysisResult | null>;
  acceptProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;
  removePromotedField: (proposalId: string) => void;
  removePromotedFieldsForDocument: (documentId: string) => void;
  reanalyzeFile: (documentId: string) => Promise<AnalysisResult | null>;
  getProposalsForDocument: (documentId: string) => ExtractionProposal[];
  getAnalysis: (documentId: string) => DocumentAnalysis | undefined;
  dismissAnalysis: (documentId: string) => void;
  clearAllAnalyses: () => void;
  refetch: () => Promise<void>;
  editFieldValue: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}

type LaneFactsDbRow = {
  document_id: string;
  lane: string;
  truth_state: 'extracted' | 'proposed' | 'needs_review';
  lane_confidence: number;
  requires_review: boolean;
  facts: Json;
  engine_metadata: Json;
  notes: string[];
  created_at: string;
  updated_at: string;
};

type ReviewQueueDbRow = {
  document_id: string;
  lane: string;
  reason: string;
  state: string;
  confidence_summary: Json;
  evidence_summary: Json;
  created_at: string;
  updated_at: string;
};

function laneToClassification(lane: string | null | undefined): DocumentSlotType {
  if (lane === 'passport_lane') return 'passport';
  if (lane === 'graduation_lane') return 'graduation_certificate';
  if (lane === 'language_lane') return 'language_certificate';
  return 'unknown';
}

function laneToParserType(row: LaneFactsDbRow): ParserType {
  const meta = (row.engine_metadata ?? {}) as Record<string, unknown>;
  const reviewReason = typeof meta.review_reason === 'string' ? meta.review_reason : null;
  if (reviewReason === 'image_ocr_deferred_to_door_3') return 'image_ocr';
  const producer = typeof meta.producer === 'string' ? meta.producer : '';
  if (meta.ocr_used === true || producer.includes('mistral')) return 'image_ocr';
  if (meta.pdf_text_used === true) return 'pdf_text';
  return 'regex_heuristic';
}

function toExtractedFields(facts: Json): DocumentAnalysis['extracted_fields'] {
  const obj = (facts && typeof facts === 'object' && !Array.isArray(facts))
    ? facts as Record<string, any>
    : {};

  const fields: DocumentAnalysis['extracted_fields'] = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'object') continue;
    fields[key] = {
      value: value.value ?? null,
      raw_text: value.raw ?? null,
      confidence: typeof value.confidence === 'number' ? value.confidence : 0,
      parser_source: laneToParserSource(value.source),
      evidence_snippet: null,
    };
  }
  return fields;
}

function laneToParserSource(source: unknown): ParserType {
  if (typeof source !== 'string') return 'regex_heuristic';
  if (source.includes('mrz')) return 'mrz';
  if (source.includes('ocr')) return 'image_ocr';
  if (source.includes('pdf')) return 'pdf_text';
  return 'regex_heuristic';
}

function toFieldConfidenceMap(extracted: DocumentAnalysis['extracted_fields']): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(extracted)) {
    map[key] = typeof value.confidence === 'number' ? value.confidence : 0;
  }
  return map;
}

function buildAnalysisFromLaneRow(row: LaneFactsDbRow): DocumentAnalysis {
  const extracted_fields = toExtractedFields(row.facts);
  const meta = (row.engine_metadata ?? {}) as Record<string, any>;
  const rejectionReason = row.requires_review
    ? (typeof meta.review_reason === 'string' ? meta.review_reason : 'needs_review')
    : null;

  return {
    document_id: row.document_id,
    slot_hint: laneToClassification(row.lane),
    analysis_status: 'completed',
    parser_type: laneToParserType(row),
    classification_result: laneToClassification(row.lane),
    classification_confidence: row.lane_confidence ?? 0,
    extracted_fields,
    field_confidence_map: toFieldConfidenceMap(extracted_fields),
    readability_status: row.truth_state === 'needs_review' ? 'degraded' : 'readable',
    usefulness_status: row.truth_state === 'needs_review' ? 'not_useful' : 'useful',
    duplicate_status: 'unknown',
    rejection_reason: rejectionReason,
    summary_message_internal: null,
    text_content: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildAnalysisFromReviewRow(row: ReviewQueueDbRow): DocumentAnalysis {
  const confidenceSummary = (row.confidence_summary ?? {}) as Record<string, any>;
  const classification = laneToClassification(row.lane);
  const failed = row.reason === 'mistral_pipeline_error';

  return {
    document_id: row.document_id,
    slot_hint: classification,
    analysis_status: failed ? 'failed' : 'completed',
    parser_type: 'none',
    classification_result: classification,
    classification_confidence:
      typeof confidenceSummary.lane_confidence === 'number'
        ? confidenceSummary.lane_confidence
        : typeof confidenceSummary.family_confidence === 'number'
          ? confidenceSummary.family_confidence
          : 0,
    extracted_fields: {},
    field_confidence_map: {},
    readability_status: failed ? 'unreadable' : 'degraded',
    usefulness_status: 'not_useful',
    duplicate_status: 'unknown',
    rejection_reason: row.reason,
    summary_message_internal: null,
    text_content: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Mistral fact key → canonical field_key map ───────────────
const PASSPORT_FIELD_MAP: Record<string, string> = {
  full_name: 'identity.passport_name',
  passport_number: 'identity.passport_number',
  date_of_birth: 'identity.date_of_birth',
  nationality: 'identity.citizenship',
  issuing_country: 'identity.passport_issuing_country',
  expiry_date: 'identity.passport_expiry_date',
  issue_date: 'identity.passport_issue_date',
  gender: 'identity.gender',
};
const GRADUATION_FIELD_MAP: Record<string, string> = {
  full_name: 'academic.full_name',
  institution_name: 'academic.awarding_institution',
  qualification: 'academic.credential_name',
  issue_date: 'academic.degree_conferral_date',
};
const LANGUAGE_FIELD_MAP: Record<string, string> = {
  full_name: 'language.full_name',
  test_name: 'language.english_test_type',
  overall_score: 'language.english_total_score',
  test_date: 'language.test_date',
};

function fieldMapForLane(lane: string | null | undefined): Record<string, string> {
  if (lane === 'passport_lane') return PASSPORT_FIELD_MAP;
  if (lane === 'graduation_lane') return GRADUATION_FIELD_MAP;
  if (lane === 'language_lane') return LANGUAGE_FIELD_MAP;
  return {};
}

function buildProposal(params: {
  row: LaneFactsDbRow;
  studentId: string;
  fieldKey: string;
  value: string;
  confidence: number;
}): ExtractionProposal {
  const { row, studentId, fieldKey, value, confidence } = params;
  const now = row.updated_at || row.created_at || new Date().toISOString();
  return {
    proposal_id: `${row.document_id}:${fieldKey}`,
    student_id: studentId,
    document_id: row.document_id,
    field_key: fieldKey,
    proposed_value: value,
    normalized_value: value,
    confidence,
    proposal_status: confidence >= 0.85 ? 'auto_accepted' : 'pending_review',
    conflict_with_current: false,
    requires_review: confidence < 0.85,
    auto_apply_candidate: confidence >= 0.85,
    created_at: now,
    updated_at: now,
  };
}

function extractGraduationYear(value: string): string | null {
  const years = value.match(/\b(19|20)\d{2}\b/g) ?? [];
  if (years.length === 0) return null;
  return years[years.length - 1] ?? null;
}

function buildProposalsFromLaneRow(
  row: LaneFactsDbRow,
  studentId: string,
): ExtractionProposal[] {
  const facts = (row.facts && typeof row.facts === 'object' && !Array.isArray(row.facts))
    ? row.facts as Record<string, any>
    : {};
  const map = fieldMapForLane(row.lane);
  const out: ExtractionProposal[] = [];
  const seen = new Set<string>();

  for (const [rawKey, raw] of Object.entries(facts)) {
    if (!raw || typeof raw !== 'object') continue;
    const fieldKey = map[rawKey];
    if (!fieldKey) continue;
    const value = raw.value != null ? String(raw.value) : null;
    if (!value) continue;
    const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0;
    out.push(buildProposal({ row, studentId, fieldKey, value, confidence }));
    seen.add(fieldKey);

    if (row.lane === 'graduation_lane' && rawKey === 'issue_date') {
      const year = extractGraduationYear(value);
      if (year && !seen.has('academic.graduation_year')) {
        out.push(buildProposal({
          row,
          studentId,
          fieldKey: 'academic.graduation_year',
          value: year,
          confidence: Math.max(0, confidence - 0.05),
        }));
        seen.add('academic.graduation_year');
      }
    }
  }

  return out;
}

function buildHydratedSurface(documentId: string, structuredArtifactSummary: unknown): HydratedArtifactSurface {
  return {
    documentId,
    documentFilename: null,
    artifactSummary: null,
    structuredArtifactSummary,
  };
}

export function useDocumentAnalysis(
  opts: UseDocumentAnalysisOptions,
): UseDocumentAnalysisResult {
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [proposals, setProposals] = useState<ExtractionProposal[]>([]);
  const [promotedFields] = useState<PromotedField[]>([]);
  const [artifacts] = useState<Record<string, ReadingArtifact>>({});
  const [hydratedArtifactSurfaces, setHydratedArtifactSurfaces] = useState<Record<string, HydratedArtifactSurface>>({});
  const [liveStages, setLiveStages] = useState<Record<string, LiveStageState>>({});
  const [authReady, setAuthReady] = useState(false);
  const startTimesRef = useRef<Record<string, number>>({});

  const upsertStage = useCallback((state: LiveStageState) => {
    setLiveStages(prev => ({ ...prev, [state.documentId]: state }));
  }, []);

  const clearStageLater = useCallback((documentId: string, ms = 4500) => {
    window.setTimeout(() => {
      setLiveStages(prev => {
        if (!prev[documentId]) return prev;
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }, ms);
  }, []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(() => {
      if (active) setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (active) setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!authReady) return;

    if (!opts.studentId) {
      setAnalyses([]);
      setHydratedArtifactSurfaces({});
      setProposals([]);
      return;
    }

    const [laneRes, reviewRes] = await Promise.all([
      (supabase as any)
        .from('document_lane_facts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500),
      (supabase as any)
        .from('document_review_queue')
        .select('*')
        .eq('state', 'pending')
        .order('updated_at', { ascending: false })
        .limit(500),
    ]);

    if (laneRes.error) {
      // eslint-disable-next-line no-console
      console.warn('[useDocumentAnalysis] lane_facts query failed', laneRes.error);
    }
    if (reviewRes.error) {
      // eslint-disable-next-line no-console
      console.warn('[useDocumentAnalysis] review_queue query failed', reviewRes.error);
    }

    const hasBlockingReadError = Boolean(
      (laneRes.error && !laneRes.data) ||
      (reviewRes.error && !reviewRes.data)
    );

    if (hasBlockingReadError) {
      // eslint-disable-next-line no-console
      console.warn('[useDocumentAnalysis] preserving hydrated analysis state after transient read failure');
      return;
    }

    const nextAnalyses = new Map<string, DocumentAnalysis>();
    const nextHydrated: Record<string, HydratedArtifactSurface> = {};
    const nextProposals: ExtractionProposal[] = [];

    for (const row of (laneRes.data ?? []) as LaneFactsDbRow[]) {
      const analysis = buildAnalysisFromLaneRow(row);
      nextAnalyses.set(row.document_id, analysis);
      nextHydrated[row.document_id] = buildHydratedSurface(row.document_id, row.facts);
      nextProposals.push(...buildProposalsFromLaneRow(row, opts.studentId ?? ''));
    }

    for (const row of (reviewRes.data ?? []) as ReviewQueueDbRow[]) {
      if (nextAnalyses.has(row.document_id)) continue;
      const analysis = buildAnalysisFromReviewRow(row);
      nextAnalyses.set(row.document_id, analysis);
      nextHydrated[row.document_id] = buildHydratedSurface(row.document_id, row.evidence_summary);
    }

    const list = Array.from(nextAnalyses.values()).sort(
      (a, b) => Date.parse(b.updated_at || b.created_at || '') - Date.parse(a.updated_at || a.created_at || ''),
    );

    setAnalyses(list);
    setHydratedArtifactSurfaces(nextHydrated);
    setProposals(nextProposals);
  }, [authReady, opts.studentId]);

  const pollForDocument = useCallback(async (documentId: string, filename: string) => {
    const startedAt = startTimesRef.current[documentId] ?? Date.now();

    for (let i = 0; i < 18; i++) {
      const [laneRes, reviewRes] = await Promise.all([
        (supabase as any)
          .from('document_lane_facts')
          .select('*')
          .eq('document_id', documentId)
          .maybeSingle(),
        (supabase as any)
          .from('document_review_queue')
          .select('*')
          .eq('document_id', documentId)
          .eq('state', 'pending')
          .maybeSingle(),
      ]);

      if (laneRes.data) {
        await refetch();
        upsertStage({
          documentId,
          filename,
          stage: 'completed',
          detail: null,
          elapsed_ms: Date.now() - startedAt,
          updated_at: Date.now(),
        });
        clearStageLater(documentId);
        return buildAnalysisFromLaneRow(laneRes.data as LaneFactsDbRow);
      }

      if (reviewRes.data) {
        const failed = (reviewRes.data as ReviewQueueDbRow).reason === 'mistral_pipeline_error';
        await refetch();
        upsertStage({
          documentId,
          filename,
          stage: failed ? 'failed' : 'completed',
          detail: (reviewRes.data as ReviewQueueDbRow).reason ?? null,
          elapsed_ms: Date.now() - startedAt,
          updated_at: Date.now(),
        });
        clearStageLater(documentId);
        return buildAnalysisFromReviewRow(reviewRes.data as ReviewQueueDbRow);
      }

      await new Promise(resolve => window.setTimeout(resolve, 1200));
    }

    await refetch();
    clearStageLater(documentId, 2000);
    return null;
  }, [clearStageLater, refetch, upsertStage]);

  useEffect(() => {
    if (!authReady) return;

    void refetch();

    const handleRefresh = () => {
      void refetch();
    };

    window.addEventListener('crm-refresh-data', handleRefresh);
    return () => window.removeEventListener('crm-refresh-data', handleRefresh);
  }, [authReady, refetch]);

  const analyzeFile = useCallback(async (
    file: File,
    documentId: string,
  ): Promise<AnalysisResult | null> => {
    startTimesRef.current[documentId] = Date.now();
    upsertStage({
      documentId,
      filename: file.name,
      stage: 'reading',
      detail: null,
      elapsed_ms: 0,
      updated_at: Date.now(),
    });

    const analysis = await pollForDocument(documentId, file.name);
    if (!analysis) return null;

    return {
      analysis,
      proposals: [],
      artifact: null,
      structured_artifact: hydratedArtifactSurfaces[documentId]?.structuredArtifactSummary ?? null,
    };
  }, [hydratedArtifactSurfaces, pollForDocument, upsertStage]);

  const reanalyzeFile = useCallback(async (documentId: string): Promise<AnalysisResult | null> => {
    const existing = analyses.find(a => a.document_id === documentId);
    const filename = documentId;
    startTimesRef.current[documentId] = Date.now();
    upsertStage({
      documentId,
      filename,
      stage: 'reading',
      detail: null,
      elapsed_ms: 0,
      updated_at: Date.now(),
    });
    const analysis = await pollForDocument(documentId, filename);
    if (!analysis && existing) {
      return { analysis: existing, proposals: [], artifact: null, structured_artifact: null };
    }
    return analysis ? { analysis, proposals: [], artifact: null, structured_artifact: null } : null;
  }, [analyses, pollForDocument, upsertStage]);

  const dismissAnalysis = useCallback((documentId: string) => {
    setAnalyses(prev => prev.filter(a => a.document_id !== documentId));
    setHydratedArtifactSurfaces(prev => {
      if (!prev[documentId]) return prev;
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
    setLiveStages(prev => {
      if (!prev[documentId]) return prev;
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
  }, []);

  const clearAllAnalyses = useCallback(() => {
    setAnalyses([]);
    setHydratedArtifactSurfaces({});
    setLiveStages({});
  }, []);

  const getAnalysis = useCallback(
    (documentId: string) => analyses.find(a => a.document_id === documentId),
    [analyses],
  );

  const getProposalsForDocument = useCallback(
    (documentId: string) => proposals.filter(p => p.document_id === documentId),
    [proposals],
  );
  const noop = useCallback(() => {
    // eslint-disable-next-line no-console
    console.warn('[useDocumentAnalysis] Proposal editing is not wired to the Mistral truth tables yet.');
  }, []);

  const isAnalyzing = useMemo(
    () => Object.values(liveStages).some(stage => stage.stage !== 'completed' && stage.stage !== 'failed'),
    [liveStages],
  );

  return {
    analyses,
    proposals,
    promotedFields,
    artifacts,
    hydratedArtifactSurfaces,
    isAnalyzing,
    liveStages,
    analyzeFile,
    acceptProposal: noop,
    rejectProposal: noop,
    removePromotedField: noop,
    removePromotedFieldsForDocument: noop,
    reanalyzeFile,
    getProposalsForDocument,
    getAnalysis,
    dismissAnalysis,
    clearAllAnalyses,
    refetch,
    editFieldValue: noop,
  };
}
