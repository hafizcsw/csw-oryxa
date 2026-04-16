// ═══════════════════════════════════════════════════════════════
// useDocumentAnalysis — Door 3: Analysis + proposal state
// ═══════════════════════════════════════════════════════════════
// Manages analysis results and proposals for uploaded documents.
// Integrates with useDocumentRegistry (Door 2) and
// useCanonicalStudentFile (Door 1).
// No external LLM. No OpenAI.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type {
  ExtractionProposal,
  ProposalStatus,
} from '@/features/documents/extraction-proposal-model';
import { analyzeDocument, type AnalysisResult } from '@/features/documents/analysis-engine';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import type { FieldProvenance, FieldSourceType } from '@/features/student-file/canonical-model';
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

interface UseDocumentAnalysisResult {
  /** All analysis records */
  analyses: DocumentAnalysis[];
  /** All proposals (across all documents) */
  proposals: ExtractionProposal[];
  /** Fields promoted to canonical truth */
  promotedFields: PromotedField[];
  /** True when any analysis is running */
  isAnalyzing: boolean;
  /** Run analysis on a file */
  analyzeFile: (file: File, documentId: string, slotHint: DocumentSlotType | null) => Promise<AnalysisResult | null>;
  /** Manually accept a proposal */
  acceptProposal: (proposalId: string) => void;
  /** Manually reject a proposal */
  rejectProposal: (proposalId: string) => void;
  /** Remove a single promoted field from canonical truth */
  removePromotedField: (proposalId: string) => void;
  /** Remove all promoted fields for a document */
  removePromotedFieldsForDocument: (documentId: string) => void;
  /** Re-analyze a previously analyzed document */
  reanalyzeFile: (documentId: string) => Promise<AnalysisResult | null>;
  /** Get proposals for a specific document */
  getProposalsForDocument: (documentId: string) => ExtractionProposal[];
  /** Get analysis for a specific document */
  getAnalysis: (documentId: string) => DocumentAnalysis | undefined;
  /** Dismiss a single analysis */
  dismissAnalysis: (documentId: string) => void;
  /** Clear all analyses */
  clearAllAnalyses: () => void;
}

export function useDocumentAnalysis({
  studentId,
  canonicalFile,
}: UseDocumentAnalysisOptions): UseDocumentAnalysisResult {
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([]);
  const [proposals, setProposals] = useState<ExtractionProposal[]>([]);
  const [promotedFields, setPromotedFields] = useState<PromotedField[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzingCount = useRef(0);
  /** Cache File objects for re-analysis */
  const fileCache = useRef(new Map<string, { file: File; slotHint: DocumentSlotType | null }>());

  const analyzeFile = useCallback(async (
    file: File,
    documentId: string,
    slotHint: DocumentSlotType | null,
  ): Promise<AnalysisResult | null> => {
    if (!studentId) return null;

    // Cache file for potential re-analysis
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

      // Store analysis
      setAnalyses(prev => {
        const existing = prev.findIndex(a => a.document_id === documentId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result.analysis;
          return updated;
        }
        return [...prev, result.analysis];
      });

      // Store proposals
      setProposals(prev => {
        // Remove old proposals for this document
        const filtered = prev.filter(p => p.document_id !== documentId);
        return [...filtered, ...result.proposals];
      });

      // Auto-promote accepted proposals
      const autoAccepted = result.proposals.filter(p => p.proposal_status === 'auto_accepted');
      if (autoAccepted.length > 0) {
        const newPromoted: PromotedField[] = autoAccepted
          .filter(p => p.proposed_value !== null)
          .map(p => ({
            fieldKey: p.field_key,
            value: p.proposed_value!,
            proposalId: p.proposal_id,
            documentId: p.document_id,
            source: 'auto_accepted' as const,
          }));
        setPromotedFields(prev => [...prev, ...newPromoted]);
      }

      // Always log artifact — Door 1 is not closed, we need runtime proof
      const artifact = result.artifact;
      console.log('[Door1:ReadingArtifact]', {
        chosen_route: artifact.chosen_route,
        parser_used: artifact.parser_used,
        pages_processed: artifact.pages_processed,
        total_page_count: artifact.total_page_count,
        full_text_length: artifact.full_text.length,
        full_text_preview: artifact.full_text.slice(0, 300),
        confidence: artifact.confidence,
        is_readable: artifact.is_readable,
        failure_reason: artifact.failure_reason,
        processing_time_ms: Math.round(artifact.processing_time_ms),
        input_mime: artifact.input_mime,
        input_filename: artifact.input_filename,
      });
      console.log('[Door1:Classification]', {
        documentId,
        classification: result.analysis.classification_result,
        classification_confidence: result.analysis.classification_confidence,
        parser_type: result.analysis.parser_type,
        readability: result.analysis.readability_status,
        fieldsExtracted: Object.keys(result.analysis.extracted_fields).length,
        proposals: result.proposals.length,
        summary: result.analysis.summary_message_internal,
      });

      return result;
    } finally {
      analyzingCount.current--;
      if (analyzingCount.current === 0) setIsAnalyzing(false);
    }
  }, [studentId, canonicalFile]);

  /** Re-analyze a previously analyzed document using cached File object */
  const reanalyzeFile = useCallback(async (documentId: string) => {
    const cached = fileCache.current.get(documentId);
    if (!cached) {
      console.warn('[Door1:Reanalyze] No cached file for', documentId);
      return null;
    }
    // Clear old promoted fields for this document before re-analysis
    setPromotedFields(prev => prev.filter(pf => pf.documentId !== documentId));
    setProposals(prev => prev.filter(p => p.document_id !== documentId));
    // Re-run analysis
    return analyzeFile(cached.file, documentId, cached.slotHint);
  }, [analyzeFile]);

  const acceptProposal = useCallback((proposalId: string) => {
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      return { ...p, proposal_status: 'auto_accepted' as ProposalStatus, updated_at: new Date().toISOString() };
    }));

    // Find the proposal and promote it
    setProposals(prev => {
      const proposal = prev.find(p => p.proposal_id === proposalId);
      if (proposal && proposal.proposed_value) {
        setPromotedFields(pf => [...pf, {
          fieldKey: proposal.field_key,
          value: proposal.proposed_value!,
          proposalId: proposal.proposal_id,
          documentId: proposal.document_id,
          source: 'manual_accepted' as const,
        }]);
      }
      return prev;
    });
  }, []);

  const rejectProposal = useCallback((proposalId: string) => {
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      return { ...p, proposal_status: 'rejected' as ProposalStatus, updated_at: new Date().toISOString() };
    }));
  }, []);

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
  }, []);

  const removePromotedField = useCallback((proposalId: string) => {
    setPromotedFields(prev => prev.filter(pf => pf.proposalId !== proposalId));
    // Reset the proposal back to pending so it can be re-accepted
    setProposals(prev => prev.map(p => {
      if (p.proposal_id !== proposalId) return p;
      return { ...p, proposal_status: 'pending_review' as ProposalStatus, updated_at: new Date().toISOString() };
    }));
  }, []);

  const removePromotedFieldsForDocument = useCallback((documentId: string) => {
    const toRemove = new Set(promotedFields.filter(pf => pf.documentId === documentId).map(pf => pf.proposalId));
    setPromotedFields(prev => prev.filter(pf => pf.documentId !== documentId));
    // Reset those proposals back to pending
    setProposals(prev => prev.map(p => {
      if (!toRemove.has(p.proposal_id)) return p;
      return { ...p, proposal_status: 'pending_review' as ProposalStatus, updated_at: new Date().toISOString() };
    }));
  }, [promotedFields]);

  const clearAllAnalyses = useCallback(() => {
    setAnalyses([]);
    setProposals([]);
    setPromotedFields([]);
  }, []);

  return {
    analyses,
    proposals,
    promotedFields,
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
  };
}
