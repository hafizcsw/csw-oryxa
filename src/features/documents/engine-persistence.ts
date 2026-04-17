// ═══════════════════════════════════════════════════════════════
// Engine Persistence — Trial-safe persistence layer
// ═══════════════════════════════════════════════════════════════
// Compact schema: 2 tables.
//   - document_analyses (one row per (user_id, document_id))
//   - extraction_proposals (one row per (user_id, proposal_id))
// Promoted state is DERIVED from proposal status (auto_accepted).
// Artifact + structured artifact persisted as SUMMARY JSONB only.
// No outbound document-content path. No LLM. Local engine output only.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type { DocumentAnalysis } from './document-analysis-model';
import type { ExtractionProposal } from './extraction-proposal-model';
import type { ReadingArtifact } from './reading-artifact-model';
import type { StructuredDocumentArtifact } from './structured-browser-artifact-model';

/** Compact reading-artifact summary persisted as JSONB. */
export interface PersistedArtifactSummary {
  reader_implementation: string;
  chosen_route: string;
  parser_used: string;
  readability: string;
  failure_reason: string | null;
  pages_processed: number;
  total_page_count: number;
  full_text_length: number;
  confidence: number;
  processing_time_ms: number;
  input_mime: string;
  input_filename: string;
}

/** Compact structured-artifact summary persisted as JSONB. */
export interface PersistedStructuredArtifactSummary {
  builder: string;
  local_only: boolean;
  pages_analyzed: number;
  total_row_candidates: number;
  tabular_row_candidates: number;
  table_like_region_count: number;
  header_groups: number;
  footer_groups: number;
  avg_quality_score: number;
  build_time_ms: number;
}

function summarizeArtifact(a: ReadingArtifact): PersistedArtifactSummary {
  return {
    reader_implementation: a.reader_implementation,
    chosen_route: a.chosen_route,
    parser_used: a.parser_used,
    readability: a.readability,
    failure_reason: a.failure_reason ?? null,
    pages_processed: a.pages_processed,
    total_page_count: a.total_page_count,
    full_text_length: a.full_text.length,
    confidence: a.confidence,
    processing_time_ms: Math.round(a.processing_time_ms),
    input_mime: a.input_mime,
    input_filename: a.input_filename,
  };
}

function summarizeStructured(s: StructuredDocumentArtifact): PersistedStructuredArtifactSummary {
  return {
    builder: s.builder,
    local_only: s.local_only,
    pages_analyzed: s.summary.pages_analyzed,
    total_row_candidates: s.summary.total_row_candidates,
    tabular_row_candidates: s.summary.tabular_row_candidates,
    table_like_region_count: s.summary.table_like_region_count,
    header_groups: s.summary.header_groups,
    footer_groups: s.summary.footer_groups,
    avg_quality_score: s.summary.avg_quality_score,
    build_time_ms: Math.round(s.build_time_ms),
  };
}

/** Upsert one analysis record for the current user. */
export async function persistAnalysis(params: {
  userId: string;
  analysis: DocumentAnalysis;
  documentFilename: string | null;
  artifact: ReadingArtifact | null;
  structuredArtifact: StructuredDocumentArtifact | null;
}): Promise<void> {
  const { userId, analysis, documentFilename, artifact, structuredArtifact } = params;
  const row = {
    user_id: userId,
    document_id: analysis.document_id,
    document_filename: documentFilename,
    slot_hint: analysis.slot_hint,
    analysis_status: analysis.analysis_status,
    parser_type: analysis.parser_type,
    classification_result: analysis.classification_result,
    classification_confidence: analysis.classification_confidence,
    readability_status: analysis.readability_status,
    usefulness_status: analysis.usefulness_status,
    duplicate_status: analysis.duplicate_status,
    rejection_reason: analysis.rejection_reason,
    summary_message_internal: analysis.summary_message_internal,
    extracted_fields: analysis.extracted_fields as any,
    field_confidence_map: analysis.field_confidence_map as any,
    artifact_summary: artifact ? (summarizeArtifact(artifact) as any) : null,
    structured_artifact_summary: structuredArtifact ? (summarizeStructured(structuredArtifact) as any) : null,
  };

  const { error } = await supabase
    .from('document_analyses')
    .upsert(row, { onConflict: 'user_id,document_id' });

  if (error) {
    console.warn('[EnginePersistence:analysis] upsert failed', error.message);
  }
}

/** Upsert proposals for one document. Replaces prior proposals for that doc. */
export async function persistProposals(params: {
  userId: string;
  documentId: string;
  proposals: ExtractionProposal[];
  sourceLane: 'passport' | 'transcript' | 'graduation' | 'language' | 'unknown';
}): Promise<void> {
  const { userId, documentId, proposals, sourceLane } = params;

  // Replace prior proposals for this doc (atomic-ish via delete+insert).
  const { error: delErr } = await supabase
    .from('extraction_proposals')
    .delete()
    .eq('user_id', userId)
    .eq('document_id', documentId);
  if (delErr) {
    console.warn('[EnginePersistence:proposals] delete failed', delErr.message);
  }

  if (proposals.length === 0) return;

  const rows = proposals.map(p => ({
    user_id: userId,
    document_id: documentId,
    proposal_id: p.proposal_id,
    field_path: p.field_key,
    proposed_value: p.proposed_value as any,
    raw_text: null as string | null,
    confidence: p.confidence,
    parser_source: 'engine',
    evidence_snippet: null as string | null,
    source_lane: sourceLane,
    status: p.proposal_status,
    requires_review: p.requires_review,
    auto_apply_candidate: p.auto_apply_candidate,
    rejection_reason: null as string | null,
    conflict_with_existing: p.conflict_with_current ? ({ conflict: true } as any) : null,
  }));

  const { error: insErr } = await supabase
    .from('extraction_proposals')
    .insert(rows);
  if (insErr) {
    console.warn('[EnginePersistence:proposals] insert failed', insErr.message);
  }
}

/** Update a single proposal's status (manual accept/reject/reset). */
export async function persistProposalStatus(params: {
  userId: string;
  proposalId: string;
  status: ExtractionProposal['proposal_status'];
  requiresReview: boolean;
  autoApplyCandidate: boolean;
  decidedBy: 'user' | 'engine';
}): Promise<void> {
  const { userId, proposalId, status, requiresReview, autoApplyCandidate, decidedBy } = params;
  const { error } = await supabase
    .from('extraction_proposals')
    .update({
      status,
      requires_review: requiresReview,
      auto_apply_candidate: autoApplyCandidate,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('proposal_id', proposalId);
  if (error) {
    console.warn('[EnginePersistence:proposalStatus] update failed', error.message);
  }
}

/** Delete persistence rows for a single document. */
export async function deletePersistedDocument(params: {
  userId: string;
  documentId: string;
}): Promise<void> {
  const { userId, documentId } = params;
  await supabase.from('extraction_proposals').delete().eq('user_id', userId).eq('document_id', documentId);
  await supabase.from('document_analyses').delete().eq('user_id', userId).eq('document_id', documentId);
}

/** Delete every persisted analysis + proposal for the current user. */
export async function deleteAllPersistedForUser(userId: string): Promise<void> {
  await supabase.from('extraction_proposals').delete().eq('user_id', userId);
  await supabase.from('document_analyses').delete().eq('user_id', userId);
}

// ── Hydration ────────────────────────────────────────────────

export interface HydratedEngineState {
  analyses: DocumentAnalysis[];
  proposals: ExtractionProposal[];
}

/** Load every persisted analysis + proposal for the current user. */
export async function hydrateEngineStateForUser(userId: string): Promise<HydratedEngineState> {
  const empty: HydratedEngineState = { analyses: [], proposals: [] };

  const [analysesRes, proposalsRes] = await Promise.all([
    supabase.from('document_analyses').select('*').eq('user_id', userId),
    supabase.from('extraction_proposals').select('*').eq('user_id', userId),
  ]);

  if (analysesRes.error) {
    console.warn('[EnginePersistence:hydrate] analyses load failed', analysesRes.error.message);
    return empty;
  }
  if (proposalsRes.error) {
    console.warn('[EnginePersistence:hydrate] proposals load failed', proposalsRes.error.message);
    return empty;
  }

  const analyses: DocumentAnalysis[] = (analysesRes.data ?? []).map(r => ({
    document_id: r.document_id,
    slot_hint: (r.slot_hint as any) ?? null,
    analysis_status: r.analysis_status as any,
    parser_type: r.parser_type as any,
    classification_result: (r.classification_result as any) ?? null,
    classification_confidence: Number(r.classification_confidence ?? 0),
    extracted_fields: (r.extracted_fields as any) ?? {},
    field_confidence_map: (r.field_confidence_map as any) ?? {},
    readability_status: r.readability_status as any,
    usefulness_status: r.usefulness_status as any,
    duplicate_status: r.duplicate_status as any,
    rejection_reason: (r.rejection_reason as any) ?? null,
    summary_message_internal: (r.summary_message_internal as any) ?? null,
    text_content: null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));

  const proposals: ExtractionProposal[] = (proposalsRes.data ?? []).map(r => ({
    proposal_id: r.proposal_id,
    student_id: r.user_id,
    document_id: r.document_id,
    field_key: r.field_path,
    proposed_value: r.proposed_value == null ? null : String(r.proposed_value),
    normalized_value: r.proposed_value == null ? null : String(r.proposed_value).toLowerCase().trim(),
    confidence: Number(r.confidence ?? 0),
    proposal_status: r.status as any,
    conflict_with_current: !!r.conflict_with_existing,
    requires_review: !!r.requires_review,
    auto_apply_candidate: !!r.auto_apply_candidate,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }));

  console.log('[EnginePersistence:hydrate]', JSON.stringify({
    user_id: userId,
    analyses_loaded: analyses.length,
    proposals_loaded: proposals.length,
  }, null, 2));

  return { analyses, proposals };
}
