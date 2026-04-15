/**
 * StudentApplicationsPanel — Student-facing reflection surface for submitted intake applications.
 * Shows all applications with status, doc requests, and communication context.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntakeApi } from '@/hooks/useIntakeApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Inbox, Clock, CheckCircle2, XCircle, MessageCircle,
  Loader2, AlertTriangle, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_ICONS: Record<string, typeof Clock> = {
  submitted: Clock,
  ready_for_review: Inbox,
  info_requested: MessageCircle,
  docs_received: Inbox,
  under_review: Loader2,
  accepted: CheckCircle2,
  rejected: XCircle,
  waitlisted: AlertTriangle,
  withdrawn: XCircle,
  closed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-muted text-muted-foreground',
  ready_for_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  info_requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  docs_received: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  under_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  waitlisted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  withdrawn: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

interface EnrichedApp {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  overall_score: number;
  verdict: string;
  pending_doc_requests: number;
  program: { name_en?: string; name_ar?: string; degree_level?: string } | null;
  university: { name_en?: string; name_ar?: string } | null;
  latest_comm: { id: string; last_message_at: string; last_message_preview: string } | null;
}

export function StudentApplicationsPanel() {
  const { t } = useTranslation();
  const { myApplications, myApplicationDetail, fulfillDocRequest } = useIntakeApi();
  const [apps, setApps] = useState<EnrichedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchApps = useCallback(async () => {
    try {
      setLoading(true);
      const list = await myApplications();
      setApps(list);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  }, [myApplications]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const toggleExpand = async (appId: string) => {
    if (expandedId === appId) {
      setExpandedId(null);
      setDetailData(null);
      return;
    }
    setExpandedId(appId);
    setDetailLoading(true);
    try {
      const detail = await myApplicationDetail(appId);
      setDetailData(detail);
    } catch (err) {
      console.error('Failed to load detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFulfillDoc = async (docRequestId: string) => {
    try {
      await fulfillDocRequest(docRequestId);
      toast.success(t('intake.student.doc_fulfilled'));
      if (expandedId) {
        const detail = await myApplicationDetail(expandedId);
        setDetailData(detail);
      }
      await fetchApps();
    } catch (err) {
      toast.error(t('intake.student.doc_fulfill_error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t('intake.student.no_applications')}</p>
        <p className="text-sm mt-1">{t('intake.student.no_applications_desc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{t('intake.student.title')}</h2>
        <Badge variant="secondary">{apps.length}</Badge>
      </div>

      {apps.map((app) => {
        const StatusIcon = STATUS_ICONS[app.status] || Clock;
        const isExpanded = expandedId === app.id;
        const programName = app.program?.name_en || app.program?.name_ar || '—';
        const uniName = app.university?.name_en || app.university?.name_ar || '—';

        return (
          <div key={app.id} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Summary row */}
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-start"
              onClick={() => toggleExpand(app.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{programName}</div>
                <div className="text-xs text-muted-foreground truncate">{uniName}</div>
                {app.program?.degree_level && (
                  <Badge variant="outline" className="text-[10px] mt-1">{app.program.degree_level}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4">
                {app.pending_doc_requests > 0 && (
                  <Badge variant="destructive" className="gap-1 text-xs">
                    <FileText className="h-3 w-3" />
                    {app.pending_doc_requests}
                  </Badge>
                )}
                <Badge className={`gap-1 ${STATUS_COLORS[app.status] || ''}`}>
                  <StatusIcon className="h-3 w-3" />
                  {t(`intake.status.${app.status}`)}
                </Badge>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {detailLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : detailData ? (
                  <>
                    {/* Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('intake.student.submitted')}</span>
                        <p className="font-medium">{new Date(app.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('intake.student.quality_score')}</span>
                        <p className="font-medium">{app.overall_score}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('intake.student.verdict')}</span>
                        <p className="font-medium">{app.verdict}</p>
                      </div>
                      {app.reviewed_at && (
                        <div>
                          <span className="text-muted-foreground">{t('intake.student.last_reviewed')}</span>
                          <p className="font-medium">{new Date(app.reviewed_at).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Doc requests */}
                    {((detailData.doc_requests as Array<Record<string, unknown>>) || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          {t('intake.student.doc_requests')}
                        </h4>
                        <div className="space-y-2">
                          {((detailData.doc_requests as Array<Record<string, unknown>>) || []).map((dr) => (
                            <div key={String(dr.id)} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                              <div>
                                <span className="font-medium">{String(dr.doc_type)}</span>
                                {dr.message && <p className="text-muted-foreground mt-0.5">{String(dr.message)}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={dr.status === 'received' ? 'text-green-600' : 'text-amber-600'}>
                                  {t(`intake.doc_status.${dr.status}`)}
                                </Badge>
                                {dr.status === 'requested' && (
                                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleFulfillDoc(String(dr.id))}>
                                    {t('intake.student.mark_fulfilled')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shared notes */}
                    {((detailData.shared_notes as Array<Record<string, unknown>>) || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t('intake.student.shared_notes')}
                        </h4>
                        <div className="space-y-2">
                          {((detailData.shared_notes as Array<Record<string, unknown>>) || []).map((n, idx) => (
                            <div key={idx} className="p-2 bg-muted/20 rounded-lg text-xs">
                              <p className="text-muted-foreground">{String(n.note)}</p>
                              <span className="text-[10px] text-muted-foreground">{new Date(String(n.created_at)).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {((detailData.history as Array<Record<string, unknown>>) || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {t('intake.student.timeline')}
                        </h4>
                        <div className="relative pl-3 border-l-2 border-border space-y-2">
                          {((detailData.history as Array<Record<string, unknown>>) || []).map((ev, idx) => (
                            <div key={idx} className="relative text-xs">
                              <div className="absolute -left-[0.85rem] top-0.5 h-2 w-2 rounded-full bg-primary border border-background" />
                              <Badge className={`text-[10px] ${STATUS_COLORS[String(ev.new_status)] || ''}`}>
                                {t(`intake.status.${ev.new_status}`)}
                              </Badge>
                              <span className="text-muted-foreground ml-1">
                                {new Date(String(ev.created_at)).toLocaleDateString()}
                              </span>
                              {ev.note && <p className="text-muted-foreground mt-0.5">{String(ev.note)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Communication */}
                    {((detailData.comm_threads as Array<Record<string, unknown>>) || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {t('intake.student.communication')}
                        </h4>
                        <div className="space-y-2">
                          {((detailData.comm_threads as Array<Record<string, unknown>>) || []).map((thread) => (
                            <div key={String(thread.id)} className="p-2 bg-muted/20 rounded-lg text-xs">
                              <span className="font-medium">{String(thread.subject || t('intake.student.message'))}</span>
                              {thread.last_message_preview && (
                                <p className="text-muted-foreground mt-0.5 truncate">{String(thread.last_message_preview)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
