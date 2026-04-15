// ═══════════════════════════════════════════════════════════════
// DocumentAnalysisPanel — Door 3: Runtime surface
// ═══════════════════════════════════════════════════════════════
// Shows analysis results, extracted fields, and proposal state
// for each document. Allows manual accept/reject of proposals.
// No report. No eligibility. No improvement plan.
// ═══════════════════════════════════════════════════════════════

import { CheckCircle2, XCircle, Clock, AlertTriangle, FileSearch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type { ExtractionProposal, ProposalStatus } from '@/features/documents/extraction-proposal-model';

interface DocumentAnalysisPanelProps {
  analyses: DocumentAnalysis[];
  proposals: ExtractionProposal[];
  isAnalyzing: boolean;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
}

function proposalStatusIcon(status: ProposalStatus) {
  switch (status) {
    case 'auto_accepted': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 'pending_review': return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case 'rejected': return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'superseded': return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function proposalStatusBadge(status: ProposalStatus) {
  const variants: Record<ProposalStatus, string> = {
    proposed: 'bg-muted text-muted-foreground',
    auto_accepted: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    pending_review: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
    superseded: 'bg-muted text-muted-foreground',
  };
  return variants[status] || variants.proposed;
}

function fieldKeyLabel(fieldKey: string): string {
  // Convert "identity.passport_name" → "Passport Name"
  const field = fieldKey.split('.').pop() || fieldKey;
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function DocumentAnalysisPanel({
  analyses,
  proposals,
  isAnalyzing,
  onAcceptProposal,
  onRejectProposal,
}: DocumentAnalysisPanelProps) {
  const { t } = useLanguage();

  if (analyses.length === 0 && !isAnalyzing) return null;

  const groupedProposals = new Map<string, ExtractionProposal[]>();
  for (const p of proposals) {
    const existing = groupedProposals.get(p.document_id) || [];
    existing.push(p);
    groupedProposals.set(p.document_id, existing);
  }

  const totalAccepted = proposals.filter(p => p.proposal_status === 'auto_accepted').length;
  const totalPending = proposals.filter(p => p.proposal_status === 'pending_review').length;
  const totalRejected = proposals.filter(p => p.proposal_status === 'rejected').length;

  return (
    <div className="space-y-3" data-door3-consumer="analysis-panel">
      {/* Summary strip */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <FileSearch className="h-4 w-4" />
        <span>{t('portal.analysis.documents_analyzed')}: {analyses.length}</span>
        {isAnalyzing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        <span className="text-emerald-500">{totalAccepted} {t('portal.analysis.accepted')}</span>
        <span className="text-amber-500">{totalPending} {t('portal.analysis.pending')}</span>
        <span className="text-destructive">{totalRejected} {t('portal.analysis.rejected')}</span>
      </div>

      {/* Per-document analysis */}
      <div className="space-y-2">
        {analyses.map(analysis => {
          const docProposals = groupedProposals.get(analysis.document_id) || [];
          const isCompleted = analysis.analysis_status === 'completed';
          const isFailed = analysis.analysis_status === 'failed';

          return (
            <div
              key={analysis.document_id}
              className="rounded-lg border border-border bg-card p-3"
              data-analysis-id={analysis.document_id}
              data-analysis-status={analysis.analysis_status}
            >
              {/* Document header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      isCompleted ? 'border-emerald-500/30 text-emerald-600' :
                      isFailed ? 'border-destructive/30 text-destructive' :
                      'border-border text-muted-foreground'
                    }`}
                  >
                    {analysis.classification_result || 'unknown'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(analysis.classification_confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {analysis.readability_status !== 'unknown' && (
                    <Badge variant="outline" className="text-[9px]">
                      {analysis.readability_status}
                    </Badge>
                  )}
                  {analysis.usefulness_status !== 'unknown' && (
                    <Badge variant="outline" className="text-[9px]">
                      {analysis.usefulness_status}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Rejection reason */}
              {analysis.rejection_reason && (
                <p className="text-[10px] text-destructive mb-2">
                  {analysis.rejection_reason}
                </p>
              )}

              {/* Proposals */}
              {docProposals.length > 0 && (
                <div className="space-y-1 mt-2">
                  {docProposals.map(proposal => (
                    <div
                      key={proposal.proposal_id}
                      className="flex items-center gap-2 py-1 px-2 rounded bg-muted/30"
                      data-proposal-id={proposal.proposal_id}
                      data-proposal-status={proposal.proposal_status}
                    >
                      {proposalStatusIcon(proposal.proposal_status)}
                      <span className="text-[11px] text-muted-foreground min-w-[100px]">
                        {fieldKeyLabel(proposal.field_key)}
                      </span>
                      <span className="text-[11px] text-foreground font-mono flex-1 truncate">
                        {proposal.proposed_value}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${proposalStatusBadge(proposal.proposal_status)}`}
                      >
                        {proposal.proposal_status.replace('_', ' ')}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {(proposal.confidence * 100).toFixed(0)}%
                      </span>
                      {/* Actions for pending proposals */}
                      {proposal.proposal_status === 'pending_review' && (
                        <div className="flex gap-1 ml-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-emerald-500 hover:text-emerald-600"
                            onClick={() => onAcceptProposal(proposal.proposal_id)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive/80"
                            onClick={() => onRejectProposal(proposal.proposal_id)}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* No proposals for completed analysis */}
              {isCompleted && docProposals.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic mt-1">
                  {t('portal.analysis.no_fields_extracted')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
