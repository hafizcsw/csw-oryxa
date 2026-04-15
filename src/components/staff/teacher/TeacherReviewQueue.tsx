/**
 * TeacherReviewQueue — Smart notification center for teachers.
 * Groups notifications by urgency with clear action paths.
 */
import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { updateReviewItemStatus, upsertReviewItem, useTeacherReviewItems } from '@/hooks/useTeacherOps';
import type { TeacherStudent } from '@/hooks/useTeacherStudents';
import type { TeacherSession } from '@/hooks/useTeacherSessions';
import {
  Bell, UserX, CheckCircle2, ChevronRight, Clock,
  FileWarning, CalendarX, TrendingDown, Eye, X,
  AlertCircle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  students: TeacherStudent[];
  sessions: TeacherSession[];
  onSelectStudent: (id: string) => void;
  onSelectSession: (id: string) => void;
}

interface NotificationItem {
  id: string;
  type: 'pending_review' | 'inactive_student' | 'at_risk' | 'unresolved_session';
  urgency: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  targetId: string;
  targetMode: 'student' | 'session';
  timestamp?: string;
  persisted?: boolean;
  dbStatus?: string;
}

const URGENCY_CONFIG = {
  critical: {
    icon: AlertCircle,
    containerClass: 'border-destructive/30 bg-destructive/5',
    iconClass: 'text-destructive bg-destructive/10',
    dotClass: 'bg-destructive',
  },
  warning: {
    icon: Info,
    containerClass: 'border-amber-300/50 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20',
    iconClass: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    dotClass: 'bg-amber-500',
  },
  info: {
    icon: Info,
    containerClass: 'border-primary/20 bg-primary/5',
    iconClass: 'text-primary bg-primary/10',
    dotClass: 'bg-primary',
  },
} as const;

const TYPE_ICON = {
  pending_review: FileWarning,
  inactive_student: UserX,
  at_risk: TrendingDown,
  unresolved_session: CalendarX,
} as const;

export function TeacherReviewQueue({ students, sessions, onSelectStudent, onSelectSession }: Props) {
  const { t } = useLanguage();
  const { items: persistedItems, refresh } = useTeacherReviewItems();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const studentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach(s => {
      const name = s.full_name || s.phone || s.email?.split('@')[0] || '';
      if (name) map[s.user_id] = name;
    });
    return map;
  }, [students]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const now = Date.now();
    const twoWeeks = 14 * 86400000;
    const result: NotificationItem[] = [];

    // Persisted items first
    persistedItems.forEach(item => {
      if (item.status === 'resolved') return;
      const name = item.student_user_id ? studentNameMap[item.student_user_id] : null;
      result.push({
        id: item.id,
        type: item.queue_type === 'pending_reviews' ? 'pending_review'
          : item.queue_type === 'inactive_students' ? 'inactive_student'
          : item.queue_type === 'checkpoint_failures' ? 'at_risk'
          : 'unresolved_session',
        urgency: item.urgency === 'high' ? 'critical' : item.urgency === 'medium' ? 'warning' : 'info',
        title: name || item.session_id?.slice(0, 8) || '',
        description: item.reason,
        targetId: item.student_user_id || item.session_id || item.id,
        targetMode: item.student_user_id ? 'student' : 'session',
        persisted: true,
        dbStatus: item.status,
      });
    });

    // Derive from live data if no persisted items
    if (persistedItems.length === 0) {
      sessions.forEach(session => {
        if (session.status === 'completed' && !session.summary) {
          const studentNames = session.students?.map(st => st?.full_name || studentNameMap[st?.student_user_id || ''] || '').filter(Boolean).join(', ');
          result.push({
            id: `pr-${session.id}`,
            type: 'pending_review',
            urgency: 'critical',
            title: studentNames || session.lesson_slug || t('staff.teacher.queue.session_label', { defaultValue: 'Session' }),
            description: t('staff.teacher.queue.pending_review_reason', { defaultValue: 'Completed session needs closure summary' }),
            targetId: session.id,
            targetMode: 'session',
            timestamp: session.updated_at || session.created_at,
          });
        }
        if (session.status === 'scheduled' && session.scheduled_at && new Date(session.scheduled_at).getTime() < now - 3 * 3600000) {
          result.push({
            id: `ur-${session.id}`,
            type: 'unresolved_session',
            urgency: 'warning',
            title: session.lesson_slug || t('staff.teacher.queue.session_label', { defaultValue: 'Session' }),
            description: t('staff.teacher.queue.unresolved_reason', { defaultValue: 'Past scheduled session still unresolved' }),
            targetId: session.id,
            targetMode: 'session',
            timestamp: session.scheduled_at,
          });
        }
      });

      students.forEach(student => {
        const inactive = !student.latest_activity || (now - new Date(student.latest_activity).getTime() > twoWeeks);
        if (inactive) {
          const daysSince = student.latest_activity
            ? Math.floor((now - new Date(student.latest_activity).getTime()) / 86400000)
            : null;
          result.push({
            id: `in-${student.user_id}`,
            type: 'inactive_student',
            urgency: 'critical',
            title: student.full_name || student.phone || student.email?.split('@')[0] || student.user_id.slice(0, 8),
            description: daysSince
              ? t('staff.teacher.queue.inactive_days', { defaultValue: 'Inactive for {{days}} days', days: daysSince })
              : t('staff.teacher.queue.never_active', { defaultValue: 'No recorded activity' }),
            targetId: student.user_id,
            targetMode: 'student',
            timestamp: student.latest_activity || undefined,
          });
        }
        if ((student.placement_score || 0) < 45 && (student.placement_score || 0) > 0) {
          result.push({
            id: `ar-${student.user_id}`,
            type: 'at_risk',
            urgency: 'warning',
            title: student.full_name || student.phone || student.email?.split('@')[0] || student.user_id.slice(0, 8),
            description: t('staff.teacher.queue.checkpoint_reason', { defaultValue: 'Assessment score indicates risk — may need intervention' }),
            targetId: student.user_id,
            targetMode: 'student',
          });
        }
      });
    }

    return result.filter(n => !dismissed.has(n.id)).slice(0, 20);
  }, [persistedItems, sessions, students, t, studentNameMap, dismissed]);

  const criticalCount = notifications.filter(n => n.urgency === 'critical').length;
  const warningCount = notifications.filter(n => n.urgency === 'warning').length;

  const handleDismiss = async (item: NotificationItem) => {
    setDismissed(prev => new Set(prev).add(item.id));
    if (item.persisted) {
      await updateReviewItemStatus({ review_item_id: item.id, status: 'resolved' });
      refresh();
    } else {
      // Persist as resolved so it doesn't reappear after page refresh
      await upsertReviewItem({
        queue_type: item.type === 'pending_review' ? 'pending_reviews'
          : item.type === 'inactive_student' ? 'inactive_students'
          : item.type === 'at_risk' ? 'checkpoint_failures'
          : 'unresolved_outcomes',
        urgency: item.urgency === 'critical' ? 'high' : item.urgency === 'warning' ? 'medium' : 'low',
        reason: item.description,
        student_user_id: item.targetMode === 'student' ? item.targetId : null,
        session_id: item.targetMode === 'session' ? item.targetId : null,
        status: 'resolved',
      });
      refresh();
    }
  };

  const handleAction = (item: NotificationItem) => {
    if (item.targetMode === 'student') onSelectStudent(item.targetId);
    else onSelectSession(item.targetId);
  };

  const handleSave = async (item: NotificationItem) => {
    await upsertReviewItem({
      queue_type: item.type === 'pending_review' ? 'pending_reviews'
        : item.type === 'inactive_student' ? 'inactive_students'
        : item.type === 'at_risk' ? 'checkpoint_failures'
        : 'unresolved_outcomes',
      urgency: item.urgency === 'critical' ? 'high' : item.urgency === 'warning' ? 'medium' : 'low',
      reason: item.description,
      student_user_id: item.targetMode === 'student' ? item.targetId : null,
      session_id: item.targetMode === 'session' ? item.targetId : null,
      recommended_next_action: 'open_and_review',
      status: 'open',
    });
    refresh();
  };

  const getTypeLabel = (type: NotificationItem['type']) => {
    const labels: Record<string, string> = {
      pending_review: t('staff.teacher.notif.type_pending', { defaultValue: 'Needs Review' }),
      inactive_student: t('staff.teacher.notif.type_inactive', { defaultValue: 'Inactive' }),
      at_risk: t('staff.teacher.notif.type_at_risk', { defaultValue: 'At Risk' }),
      unresolved_session: t('staff.teacher.notif.type_unresolved', { defaultValue: 'Unresolved' }),
    };
    return labels[type] || type;
  };

  const getActionLabel = (type: NotificationItem['type']) => {
    const labels: Record<string, string> = {
      pending_review: t('staff.teacher.notif.action_review', { defaultValue: 'Write Summary' }),
      inactive_student: t('staff.teacher.notif.action_contact', { defaultValue: 'Contact Student' }),
      at_risk: t('staff.teacher.notif.action_intervene', { defaultValue: 'View Profile' }),
      unresolved_session: t('staff.teacher.notif.action_resolve', { defaultValue: 'Resolve Session' }),
    };
    return labels[type] || t('staff.teacher.queue.open', { defaultValue: 'Open' });
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-4.5 w-4.5 text-foreground/70" />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[14px] h-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5">
                {criticalCount}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('staff.teacher.notif.title', { defaultValue: 'Notifications' })}
          </h3>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              {criticalCount}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              {warningCount}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {notifications.length} {t('staff.teacher.notif.total', { defaultValue: 'total' })}
        </span>
      </div>

      {/* Notification Cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {notifications.map((item) => {
            const urgencyConfig = URGENCY_CONFIG[item.urgency];
            const TypeIcon = TYPE_ICON[item.type];

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 80 }}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  urgencyConfig.containerClass,
                )}
              >
                <div className="flex items-start gap-2.5">
                  {/* Type Icon */}
                  <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', urgencyConfig.iconClass)}>
                    <TypeIcon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', urgencyConfig.dotClass)} />
                      <span className="text-[13px] font-semibold text-foreground truncate">
                        {item.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-3.5 shrink-0 border-current/20"
                      >
                        {getTypeLabel(item.type)}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                      {item.description}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-[10px] px-2.5 gap-1 rounded-md"
                        onClick={() => handleAction(item)}
                      >
                        {getActionLabel(item.type)}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      {item.persisted ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 gap-1 text-primary"
                          onClick={() => handleDismiss(item)}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('staff.teacher.notif.mark_done', { defaultValue: 'Done' })}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
                          onClick={() => handleSave(item)}
                        >
                          <Clock className="h-3 w-3" />
                          {t('staff.teacher.notif.save', { defaultValue: 'Save' })}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDismiss(item)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {item.timestamp && (
                  <div className="flex justify-end mt-1">
                    <span className="text-[9px] text-muted-foreground/60">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
