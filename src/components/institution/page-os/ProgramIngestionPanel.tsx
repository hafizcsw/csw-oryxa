/**
 * ProgramIngestionPanel — File-based program ingestion with job tracking + proposal review.
 * Upload → Job created → AI extraction → Proposals visible → Approve/Reject.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Loader2, FileText, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Eye, Check, X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface IngestionJob {
  id: string;
  file_name: string | null;
  file_type: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  model_used: string | null;
}

interface Proposal {
  id: string;
  job_id: string;
  target_entity: string;
  target_field: string;
  proposed_value: any;
  confidence: number | null;
  evidence_snippet: string | null;
  review_status: string;
}

interface Props {
  universityId: string;
}

const INGESTION_BUCKET = 'program-ingestion';

export function ProgramIngestionPanel({ universityId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [proposalsLoading, setProposalsLoading] = useState<string | null>(null);
  const [reviewingProposalId, setReviewingProposalId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('program_ingestion_jobs')
      .select('id, file_name, file_type, status, created_at, completed_at, model_used')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false })
      .limit(20);
    setJobs((data as unknown as IngestionJob[]) || []);
    setLoading(false);
  }, [universityId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const fetchProposals = async (jobId: string) => {
    setProposalsLoading(jobId);
    const { data } = await supabase
      .from('program_ingestion_proposals')
      .select('*')
      .eq('job_id', jobId)
      .order('confidence', { ascending: false });
    setProposals(prev => ({ ...prev, [jobId]: (data as Proposal[]) || [] }));
    setProposalsLoading(null);
  };

  const toggleJob = (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      if (!proposals[jobId]) fetchProposals(jobId);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const filePath = `ingestion/${universityId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from(INGESTION_BUCKET)
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // Start ingestion via edge function
      const { data, error } = await supabase.functions.invoke('university-page-manage', {
        body: {
          action: 'ingestion.start',
          university_id: universityId,
          file_path: filePath,
          file_type: file.name.split('.').pop() || 'pdf',
          file_name: file.name,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || 'Failed to start ingestion');
      }

      toast({ title: t('ingestion.started') });
      // Poll for completion
      setTimeout(() => fetchJobs(), 3000);
      setTimeout(() => fetchJobs(), 8000);
      setTimeout(() => fetchJobs(), 15000);
    } catch (err: any) {
      toast({ title: err.message || t('error.generic'), variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const reviewProposal = async (proposalId: string, jobId: string, status: 'approved' | 'rejected') => {
    setReviewingProposalId(proposalId);
    try {
      const { data, error } = await supabase.functions.invoke('university-page-manage', {
        body: {
          action: 'ingestion.review_proposal',
          university_id: universityId,
          proposal_id: proposalId,
          decision: status,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || t('error.generic'));
      }

      setProposals(prev => ({
        ...prev,
        [jobId]: (prev[jobId] || []).map(p =>
          p.id === proposalId ? { ...p, review_status: status } : p
        ),
      }));
      toast({ title: status === 'approved' ? t('ingestion.proposalApproved') : t('ingestion.proposalRejected') });
    } catch (err: any) {
      toast({ title: err.message || t('error.generic'), variant: 'destructive' });
    } finally {
      setReviewingProposalId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const confidenceColor = (c: number | null) => {
    if (c == null) return 'text-muted-foreground';
    if (c >= 0.8) return 'text-green-600';
    if (c >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('ingestion.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchJobs} className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,.csv,.docx,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button size="sm" asChild disabled={uploading} className="gap-1.5">
              <span>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {t('ingestion.uploadFile')}
              </span>
            </Button>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">{t('ingestion.description')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Upload className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('ingestion.noJobs')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const isExpanded = expandedJob === job.id;
            const jobProposals = proposals[job.id] || [];
            const pendingCount = jobProposals.filter(p => p.review_status === 'pending').length;

            return (
              <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleJob(job.id)}
                >
                  {statusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{job.file_name || job.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()} · {job.file_type?.toUpperCase()}
                    </div>
                  </div>
                  <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {job.status}
                  </Badge>
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                      {pendingCount} {t('ingestion.pending')}
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-3 bg-muted/10">
                    {proposalsLoading === job.id ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : jobProposals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        {job.status === 'completed' ? t('ingestion.noProposals') : t('ingestion.processing')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {jobProposals.length} {t('ingestion.proposalsFound')}
                        </div>
                        {jobProposals.map(proposal => (
                          <div key={proposal.id} className="border border-border rounded-lg p-2 space-y-1 bg-card">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {proposal.target_entity}
                                </Badge>
                                <span className="text-xs font-medium truncate">{proposal.target_field}</span>
                                <span className={`text-[10px] font-mono ${confidenceColor(proposal.confidence)}`}>
                                  {proposal.confidence != null ? `${Math.round(proposal.confidence * 100)}%` : '—'}
                                </span>
                              </div>
                              {proposal.review_status === 'pending' ? (
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    disabled={reviewingProposalId === proposal.id}
                                    onClick={(e) => { e.stopPropagation(); reviewProposal(proposal.id, job.id, 'approved'); }}
                                  >
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    disabled={reviewingProposalId === proposal.id}
                                    onClick={(e) => { e.stopPropagation(); reviewProposal(proposal.id, job.id, 'rejected'); }}
                                  >
                                    <X className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  variant={proposal.review_status === 'approved' ? 'default' : 'secondary'}
                                  className="text-[10px]"
                                >
                                  {proposal.review_status}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-foreground bg-muted/40 rounded p-1.5 font-mono break-all">
                              {typeof proposal.proposed_value === 'object'
                                ? JSON.stringify(proposal.proposed_value?.value ?? proposal.proposed_value, null, 0)
                                : String(proposal.proposed_value)}
                            </div>
                            {proposal.evidence_snippet && (
                              <div className="text-[10px] text-muted-foreground flex items-start gap-1">
                                <Eye className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="italic">"{proposal.evidence_snippet}"</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
