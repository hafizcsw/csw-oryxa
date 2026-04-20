// ═══════════════════════════════════════════════════════════════
// useDocumentAnalysis — STUB (legacy engine removed)
// ═══════════════════════════════════════════════════════════════
// The legacy multi-engine pipeline (Paddle / Qwen / Tesseract /
// internal OCR worker / semantic layer) has been hard-deleted.
// The replacement Mistral-only pipeline is being wired in Phase 2.
//
// This stub preserves the hook's PUBLIC SURFACE so existing UI
// (AssemblyLane, LiveProfileAssembly, ReviewQueuePanel, etc.)
// continues to compile and render empty/idle states. It performs
// NO analysis, NO persistence, NO promotion. All actions are
// safe no-ops that log a warning.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
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
  stage: string;
  detail: string | null;
  elapsed_ms: number;
  updated_at: number;
}

// Minimal shape compatible with previous AnalysisResult consumers.
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
  editFieldValue: (params: { documentId: string; fieldKey: string; newValue: string }) => void;
}

const warnOnce = (() => {
  let warned = false;
  return () => {
    if (warned) return;
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[useDocumentAnalysis] Legacy engine removed. Hook is a stub until Mistral pipeline (Phase 2) is wired.',
    );
  };
})();

export function useDocumentAnalysis(
  _opts: UseDocumentAnalysisOptions,
): UseDocumentAnalysisResult {
  const [analyses] = useState<DocumentAnalysis[]>([]);
  const [proposals] = useState<ExtractionProposal[]>([]);
  const [promotedFields] = useState<PromotedField[]>([]);
  const [artifacts] = useState<Record<string, ReadingArtifact>>({});
  const [hydratedArtifactSurfaces] = useState<Record<string, HydratedArtifactSurface>>({});
  const [liveStages] = useState<Record<string, LiveStageState>>({});

  const analyzeFile = useCallback(async () => {
    warnOnce();
    return null;
  }, []);

  const reanalyzeFile = useCallback(async () => {
    warnOnce();
    return null;
  }, []);

  const noop = useCallback(() => { warnOnce(); }, []);
  const getProposalsForDocument = useCallback(() => [], []);
  const getAnalysis = useCallback(() => undefined, []);

  return {
    analyses,
    proposals,
    promotedFields,
    artifacts,
    hydratedArtifactSurfaces,
    isAnalyzing: false,
    liveStages,
    analyzeFile,
    acceptProposal: noop,
    rejectProposal: noop,
    removePromotedField: noop,
    removePromotedFieldsForDocument: noop,
    reanalyzeFile,
    getProposalsForDocument,
    getAnalysis,
    dismissAnalysis: noop,
    clearAllAnalyses: noop,
    editFieldValue: noop,
  };
}
