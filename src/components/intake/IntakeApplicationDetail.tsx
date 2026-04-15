/**
 * IntakeApplicationDetail — Full operator workspace for a single intake application.
 * Shows applicant summary, program context, documents, timeline, notes, and decision actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntakeApi } from '@/hooks/useIntakeApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, User, GraduationCap, FileText, Clock, MessageSquare,
  Loader2, CheckCircle2, XCircle, AlertTriangle, Send, Plus, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  applicationId: string;
  universityId: string;
  onBack: () => void;
}

const TRANSITION_RULES: Record<string, string[]> = {
  submitted: ['ready_for_review', 'info_requested', 'under_review', 'withdrawn', 'closed'],
  ready_for_review: ['under_review', 'info_requested', 'closed'],
  info_requested: ['docs_received', 'under_review', 'withdrawn', 'closed'],
  docs_received: ['ready_for_review', 'under_review', 'info_requested', 'closed'],
  under_review: ['accepted', 'rejected', 'waitlisted', 'info_requested', 'closed'],
  accepted: ['closed'],
  rejected: ['closed'],
  waitlisted: ['accepted', 'rejected', 'under_review', 'closed'],
  withdrawn: ['closed'],
  closed: [],
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

export function IntakeApplicationDetail({ applicationId, universityId, onBack }: Props) {
  const { t } = useTranslation();
  const { getDetail, transition, requestDocs, addNote } = useIntakeApi();

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Decision form
  const [selectedTransition, setSelectedTransition] = useState('');
  const [transitionNote, setTransitionNote] = useState('');

  // Doc request form
  const [showDocForm, setShowDocForm] = useState(false);
  const [docType, setDocType] = useState('');
  const [docMessage, setDocMessage] = useState('');

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'internal' | 'shared'>('internal');

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getDetail(applicationId);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
      toast.error(t('intake.detail.load_error'));
    } finally {
      setLoading(false);
    }
  }, [applicationId, getDetail, t]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleTransition = async () => {
    if (!selectedTransition) return;
    try {
      setActionLoading(true);
      await transition({ applicationId, newStatus: selectedTransition, note: transitionNote || undefined });
      toast.success(t('intake.detail.transition_success'));
      setSelectedTransition('');
      setTransitionNote('');
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocRequest = async () => {
    if (!docType.trim()) return;
    try {
      setActionLoading(true);
      await requestDocs({ applicationId, docType: docType.trim(), message: docMessage || undefined });
      toast.success(t('intake.detail.doc_request_sent'));
      setShowDocForm(false);
      setDocType('');
      setDocMessage('');
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      setActionLoading(true);
      await addNote({ applicationId, note: noteText.trim(), visibility: noteVisibility });
      toast.success(t('intake.detail.note_added'));
      setShowNoteForm(false);
      setNoteText('');
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const app = data.application as Record<string, unknown>;
  const applicant = data.applicant as Record<string, unknown> | null;
  const program = data.program as Record<string, unknown> | null;
  const university = data.university as Record<string, unknown> | null;
  const history = (data.history as Array<Record<string, unknown>>) || [];
  const docRequests = (data.doc_requests as Array<Record<string, unknown>>) || [];
  const notes = (data.notes as Array<Record<string, unknown>>) || [];
  const commThreads = (data.comm_threads as Array<Record<string, unknown>>) || [];
  const currentStatus = String(app.status || 'submitted');
  const allowedTransitions = TRANSITION_RULES[currentStatus] || [];
  const fqs = app.file_quality_snapshot as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex-1" />
        <Badge className={`text-sm ${STATUS_COLORS[currentStatus] || ''}`}>
          {t(`intake.status.${currentStatus}`)}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Applicant Summary ── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('intake.detail.applicant_summary')}</h3>
          </div>
          {applicant ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {applicant.full_name && <Field label={t('intake.detail.name')} value={String(applicant.full_name)} />}
              {applicant.email && <Field label={t('intake.detail.email')} value={String(applicant.email)} />}
              {applicant.phone && <Field label={t('intake.detail.phone')} value={String(applicant.phone)} />}
              {applicant.citizenship && <Field label={t('intake.detail.citizenship')} value={String(applicant.citizenship)} />}
              {applicant.gpa && <Field label={t('intake.detail.gpa')} value={String(applicant.gpa)} />}
              {applicant.last_education_level && <Field label={t('intake.detail.education_level')} value={String(applicant.last_education_level)} />}
              {applicant.preferred_degree_level && <Field label={t('intake.detail.preferred_degree')} value={String(applicant.preferred_degree_level)} />}
              {applicant.preferred_major && <Field label={t('intake.detail.preferred_major')} value={String(applicant.preferred_major)} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('intake.detail.applicant_unavailable')}</p>
          )}
        </div>

        {/* ── Program & University Context ── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('intake.detail.program_context')}</h3>
          </div>
          {program ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Field label={t('intake.detail.program')} value={String(program.name_en || program.name_ar || '')} />
              {program.degree_level && <Field label={t('intake.detail.degree')} value={String(program.degree_level)} />}
              {program.teaching_language && <Field label={t('intake.detail.language')} value={String(program.teaching_language)} />}
              {program.gpa_min && <Field label={t('intake.detail.min_gpa')} value={String(program.gpa_min)} />}
              {program.ielts_min_overall && <Field label="IELTS" value={String(program.ielts_min_overall)} />}
              {program.toefl_min && <Field label="TOEFL" value={String(program.toefl_min)} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('intake.detail.program_unavailable')}</p>
          )}
          {university && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{String(university.name_en || university.name_ar || '')}</span>
              {university.city && <span className="text-xs text-muted-foreground"> — {String(university.city)}</span>}
            </div>
          )}
        </div>

        {/* ── File Quality Snapshot ── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('intake.detail.quality_snapshot')}</h3>
          </div>
          {fqs ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('intake.detail.overall_score')}</span>
                <span className="font-semibold">{String(app.overall_score)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('intake.detail.verdict')}</span>
                <Badge variant="outline">{String(app.verdict)}</Badge>
              </div>
              {fqs.dimensions && (
                <div className="grid grid-cols-2 gap-1 pt-2">
                  {Object.entries(fqs.dimensions as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{k}</span>
                      <span>{v}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('intake.detail.no_snapshot')}</p>
          )}
          <div className="text-xs text-muted-foreground pt-1">
            {t('intake.detail.submitted_at')}: {new Date(String(app.submitted_at)).toLocaleString()}
          </div>
          {app.reviewed_at && (
            <div className="text-xs text-muted-foreground">
              {t('intake.detail.reviewed_at')}: {new Date(String(app.reviewed_at)).toLocaleString()}
            </div>
          )}
        </div>

        {/* ── Document Requests ── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">{t('intake.detail.doc_requests')}</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowDocForm(!showDocForm)} className="gap-1">
              <Plus className="h-3 w-3" />
              {t('intake.detail.request_doc')}
            </Button>
          </div>

          {showDocForm && (
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <Input
                placeholder={t('intake.detail.doc_type_placeholder')}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              />
              <Textarea
                placeholder={t('intake.detail.doc_message_placeholder')}
                value={docMessage}
                onChange={(e) => setDocMessage(e.target.value)}
                className="h-16"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={actionLoading || !docType.trim()} onClick={handleDocRequest}>
                  <Send className="h-3 w-3 mr-1" />
                  {t('intake.detail.send_request')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDocForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {docRequests.length > 0 ? (
            <div className="space-y-2">
              {docRequests.map((dr) => (
                <div key={String(dr.id)} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                  <div>
                    <span className="font-medium">{String(dr.doc_type)}</span>
                    {dr.message && <p className="text-muted-foreground mt-0.5">{String(dr.message)}</p>}
                  </div>
                  <Badge variant="outline" className={dr.status === 'received' ? 'text-green-600' : 'text-amber-600'}>
                    {t(`intake.doc_status.${dr.status}`)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('intake.detail.no_doc_requests')}</p>
          )}
        </div>
      </div>

      {/* ── Communication Threads ── */}
      {commThreads.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('intake.detail.linked_threads')}</h3>
          </div>
          <div className="space-y-2">
            {commThreads.map((thread) => (
              <div key={String(thread.id)} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                <div>
                  <span className="font-medium">{String(thread.subject || t('intake.detail.thread'))}</span>
                  {thread.last_message_preview && (
                    <p className="text-muted-foreground mt-0.5 truncate max-w-xs">{String(thread.last_message_preview)}</p>
                  )}
                </div>
                <Badge variant="outline">{String(thread.status)}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Timeline / History ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{t('intake.detail.timeline')}</h3>
        </div>
        {history.length > 0 ? (
          <div className="relative pl-4 border-l-2 border-border space-y-4">
            {history.map((ev, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[1.35rem] top-0.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <div className="text-xs">
                  <Badge className={`text-xs ${STATUS_COLORS[String(ev.new_status)] || ''}`}>
                    {t(`intake.status.${ev.new_status}`)}
                  </Badge>
                  {ev.old_status && (
                    <span className="text-muted-foreground ml-1">← {t(`intake.status.${ev.old_status}`)}</span>
                  )}
                  <span className="text-muted-foreground ml-2">
                    {new Date(String(ev.created_at)).toLocaleString()}
                  </span>
                </div>
                {ev.note && <p className="text-xs text-muted-foreground mt-1">{String(ev.note)}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('intake.detail.no_history')}</p>
        )}
      </div>

      {/* ── Reviewer Notes ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('intake.detail.reviewer_notes')}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowNoteForm(!showNoteForm)} className="gap-1">
            <Plus className="h-3 w-3" />
            {t('intake.detail.add_note')}
          </Button>
        </div>

        {showNoteForm && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <Textarea
              placeholder={t('intake.detail.note_placeholder')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="h-20"
            />
            <div className="flex items-center gap-2">
              <Select value={noteVisibility} onValueChange={(v) => setNoteVisibility(v as 'internal' | 'shared')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{t('intake.detail.visibility_internal')}</SelectItem>
                  <SelectItem value="shared">{t('intake.detail.visibility_shared')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" disabled={actionLoading || !noteText.trim()} onClick={handleAddNote}>
                {t('intake.detail.save_note')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={String(n.id)} className="p-2 bg-muted/20 rounded-lg text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{String(n.author_id).slice(0, 8)}…</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {String(n.visibility) === 'shared' ? t('intake.detail.visibility_shared') : t('intake.detail.visibility_internal')}
                    </Badge>
                    <span className="text-muted-foreground">{new Date(String(n.created_at)).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-muted-foreground">{String(n.note)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t('intake.detail.no_notes')}</p>
        )}
      </div>

      {/* ── Decision Actions ── */}
      {allowedTransitions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">{t('intake.detail.decision_actions')}</h3>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('intake.detail.transition_to')}</label>
              <Select value={selectedTransition} onValueChange={setSelectedTransition}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('intake.detail.select_status')} />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>{t(`intake.status.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs text-muted-foreground">{t('intake.detail.transition_note')}</label>
              <Input
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder={t('intake.detail.transition_note_placeholder')}
              />
            </div>
            <Button
              disabled={!selectedTransition || actionLoading}
              onClick={handleTransition}
              className="gap-1.5"
              variant={['accepted'].includes(selectedTransition) ? 'default' : ['rejected', 'closed'].includes(selectedTransition) ? 'destructive' : 'outline'}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {t('intake.detail.apply_transition')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
