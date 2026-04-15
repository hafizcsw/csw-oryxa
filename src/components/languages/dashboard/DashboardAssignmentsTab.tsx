import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Send, FileText, ChevronRight, ArrowLeft, ArrowRight, Loader2, BookOpen, ClipboardCheck, Target, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DSButton } from "@/components/design-system/DSButton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { AssignmentItem } from "@/hooks/useLearningState";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import { useStudentActionItems, completeStudentActionItem, deleteStudentActionItem } from '@/hooks/useSessionActionItems';
import type { SessionActionItem } from '@/hooks/useSessionActionItems';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
  assignments: AssignmentItem[];
  onSubmit: (id: string, text: string | null, notes: string | null) => Promise<boolean>;
  onStart: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  new: { icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  in_progress: { icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  submitted: { icon: Send, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  reviewed: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  overdue: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  pending: { icon: BookOpen, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  completed: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
};

const ACTION_TYPE_ICONS: Record<string, LucideIcon> = {
  homework: BookOpen,
  review: ClipboardCheck,
  checkpoint: Target,
  session_recovery: AlertTriangle,
  exam_recovery: AlertTriangle,
  teacher_follow_up: Sparkles,
};

type FilterKey = 'all' | 'pending' | 'submitted' | 'reviewed';

interface UnifiedItem {
  id: string;
  kind: 'assignment' | 'action';
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  raw: AssignmentItem | SessionActionItem;
}

export function DashboardAssignmentsTab({ assignments, onSubmit, onStart, operatingSystemData }: Props) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const displayLocale = language || "en";
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'assignment' | 'action'>('assignment');
  const [submissionText, setSubmissionText] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionResponses, setActionResponses] = useState<Record<string, string>>({});

  const { items: actionItems, loading: actionsLoading, refresh: refreshActions } = useStudentActionItems();

  const formatStatus = (status: string) => translateLanguageCourseValue(t, `languages.dashboard.assignmentStatus.${status}`, status);

  // Unify both lists
  const unified: UnifiedItem[] = useMemo(() => {
    const fromAssignments: UnifiedItem[] = assignments.map(a => ({
      id: a.id, kind: 'assignment', title: a.title, description: a.description,
      status: a.status, dueDate: a.due_date, raw: a,
    }));
    const fromActions: UnifiedItem[] = actionItems.map(a => ({
      id: a.id, kind: 'action', title: a.title, description: a.description,
      status: a.status, dueDate: a.due_at, raw: a,
    }));
    return [...fromAssignments, ...fromActions];
  }, [assignments, actionItems]);

  const filtered = filter === 'all' ? unified
    : filter === 'pending' ? unified.filter(u => ['new', 'in_progress', 'overdue', 'pending'].includes(u.status))
    : filter === 'submitted' ? unified.filter(u => u.status === 'submitted')
    : unified.filter(u => ['reviewed', 'completed'].includes(u.status));

  const pendingCount = unified.filter(u => ['new', 'in_progress', 'overdue', 'pending'].includes(u.status)).length;

  // Detail view for assignment
  const selectedAssignment = selectedKind === 'assignment' ? assignments.find(a => a.id === selectedId) : null;

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    const success = await onSubmit(selectedId, submissionText || null, submissionNotes || null);
    setSubmitting(false);
    if (success) { setSubmissionText(""); setSubmissionNotes(""); }
  };

  const handleActionComplete = async (item: SessionActionItem) => {
    setSubmitting(true);
    const res = await completeStudentActionItem(item.id, actionResponses[item.id] || undefined);
    if (res.ok) {
      toast({ title: t('languages.dashboard.actions.completed', { defaultValue: 'Action completed!' }) });
      refreshActions();
    } else {
      toast({ title: t('languages.dashboard.actions.error', { defaultValue: 'Failed' }), variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleDeleteItem = async (item: UnifiedItem) => {
    if (item.kind === 'action') {
      const res = await deleteStudentActionItem(item.id);
      if (res.ok) {
        toast({ title: t('languages.dashboard.actions.deleted', { defaultValue: 'Deleted' }) });
        refreshActions();
      } else {
        toast({ title: t('languages.dashboard.actions.error', { defaultValue: 'Failed' }), variant: 'destructive' });
      }
    }
  };

  // Empty state
  if (unified.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{t("languages.dashboard.noAssignments")}</h3>
        <p className="text-sm text-muted-foreground">{t("languages.dashboard.noAssignmentsDesc")}</p>
      </motion.div>
    );
  }

  // === Detail: Assignment ===
  if (selectedAssignment) {
    const config = STATUS_CONFIG[selectedAssignment.status] || STATUS_CONFIG.new;
    const StatusIcon = config.icon;
    const canSubmit = ['new', 'in_progress', 'overdue'].includes(selectedAssignment.status);
    const BackArrow = isAr ? ArrowRight : ArrowLeft;

    return (
      <motion.div initial={{ opacity: 0, x: isAr ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BackArrow className="w-4 h-4" /> {t("languages.dashboard.backToAssignments")}
        </button>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
              <StatusIcon className={cn("w-5 h-5", config.color)} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground mb-0.5">{selectedAssignment.title}</h3>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.bg, config.color)}>
                {formatStatus(selectedAssignment.status)}
              </span>
            </div>
          </div>
          {selectedAssignment.description && <p className="text-sm text-muted-foreground mb-4">{selectedAssignment.description}</p>}
          {selectedAssignment.instructions && (
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("languages.dashboard.assignmentInstructions")}</h4>
              <p className="text-sm text-foreground whitespace-pre-line">{selectedAssignment.instructions}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
            {selectedAssignment.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t("languages.dashboard.dueDate")}: {new Date(selectedAssignment.due_date).toLocaleDateString(displayLocale)}</span>}
            {selectedAssignment.submitted_at && <span className="flex items-center gap-1"><Send className="w-3 h-3" />{t("languages.dashboard.submittedAt")}: {new Date(selectedAssignment.submitted_at).toLocaleDateString(displayLocale)}</span>}
          </div>
          {selectedAssignment.status === 'reviewed' && (
            <div className="space-y-3 mb-4">
              {selectedAssignment.score !== null && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{t("languages.dashboard.score")}</h4>
                  <p className="text-2xl font-bold text-primary">{selectedAssignment.score}%</p>
                </div>
              )}
              {selectedAssignment.feedback && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("languages.dashboard.teacherFeedback")}</h4>
                  <p className="text-sm text-foreground whitespace-pre-line">{selectedAssignment.feedback}</p>
                </div>
              )}
            </div>
          )}
          {selectedAssignment.submission_text && selectedAssignment.status !== 'new' && (
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{t("languages.dashboard.yourSubmission")}</h4>
              <p className="text-sm text-foreground whitespace-pre-line">{selectedAssignment.submission_text}</p>
            </div>
          )}
          {canSubmit && (
            <div className="space-y-3 pt-4 border-t border-border">
              <textarea value={submissionText} onChange={e => setSubmissionText(e.target.value)}
                placeholder={t("languages.dashboard.submissionPlaceholder")}
                className="w-full min-h-[120px] p-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <DSButton onClick={handleSubmit} disabled={submitting || !submissionText.trim()} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t("languages.dashboard.submitAssignment")}
              </DSButton>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // === List view (unified) ===
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'submitted', 'reviewed'] as FilterKey[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              filter === f ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30")}>
            {translateLanguageCourseValue(t, `languages.dashboard.assignmentFilter.${f}`, f)}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ms-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Unified list */}
      <div className="space-y-2.5">
        {filtered.map((item, i) => {
          const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
          const StatusIcon = item.kind === 'action'
            ? (ACTION_TYPE_ICONS[(item.raw as SessionActionItem).action_type] || BookOpen)
            : config.icon;
          const isAction = item.kind === 'action';
          const actionItem = isAction ? item.raw as SessionActionItem : null;

          return (
            <motion.div key={`${item.kind}-${item.id}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                  <StatusIcon className={cn("w-4 h-4", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {isAction
                        ? t('languages.dashboard.actions.fromTeacher', { defaultValue: 'Teacher Task' })
                        : t('languages.dashboard.actions.courseWork', { defaultValue: 'Assignment' })
                      }
                    </Badge>
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("px-2 py-0.5 rounded-full font-medium", config.bg, config.color)}>
                      {formatStatus(item.status)}
                    </span>
                    {item.dueDate && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.dueDate).toLocaleDateString(displayLocale)}</span>
                    )}
                    {!isAction && (item.raw as AssignmentItem).score !== null && (
                      <span className="font-medium text-primary">{(item.raw as AssignmentItem).score}%</span>
                    )}
                    {isAction && actionItem?.priority && (
                      <Badge variant={actionItem.priority === 'urgent' ? 'destructive' : 'outline'} className="text-[9px]">
                        {t(`languages.dashboard.actions.priority_${actionItem.priority}`, { defaultValue: actionItem.priority })}
                      </Badge>
                    )}
                  </div>

                  {/* Inline action complete for teacher tasks */}
                  {isAction && actionItem && actionItem.status === 'pending' && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={actionResponses[actionItem.id] || ''}
                        onChange={e => setActionResponses(prev => ({ ...prev, [actionItem.id]: e.target.value }))}
                        placeholder={t('languages.dashboard.actions.response_placeholder', { defaultValue: 'Your response (optional)...' })}
                        rows={2} className="text-sm bg-background/50 border-border/50 rounded-lg"
                      />
                      <DSButton size="sm" disabled={submitting}
                        onClick={() => handleActionComplete(actionItem)} className="gap-1.5">
                        <Send className="h-3.5 w-3.5" />
                        {t('languages.dashboard.actions.mark_complete', { defaultValue: 'Mark Complete' })}
                      </DSButton>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteItem(item)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1"
                  title={t('languages.dashboard.actions.delete', { defaultValue: 'Delete' })}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Arrow for assignments only */}
                {!isAction && (
                  <button onClick={() => { setSelectedId(item.id); setSelectedKind('assignment'); if ((item.raw as AssignmentItem).status === 'new') onStart(item.id); }}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">{t("languages.dashboard.noFilteredAssignments")}</div>
        )}
      </div>
    </div>
  );
}
