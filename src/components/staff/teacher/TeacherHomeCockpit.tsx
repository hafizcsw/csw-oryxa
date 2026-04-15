/**
 * TeacherHomeCockpit — Zoom-inspired clean teaching control center.
 * Compact, professional, no oversized elements.
 */
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, Users, Clock, Plus, UserX, Video,
  ArrowRight, ChevronRight, BookOpen, AlertCircle
} from 'lucide-react';
import { SessionCountdown } from '@/components/ui/SessionCountdown';
import type { TeacherStudent } from '@/hooks/useTeacherStudents';
import type { TeacherSession } from '@/hooks/useTeacherSessions';

interface Props {
  students: TeacherStudent[];
  sessions: TeacherSession[];
  onSelectStudent: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onSwitchTab: (tab: string) => void;
}

export function TeacherHomeCockpit({
  students, sessions, onSelectStudent, onSelectSession, onCreateSession, onSwitchTab
}: Props) {
  const { t } = useLanguage();

  const stats = useMemo(() => {
    const now = Date.now();
    const day3 = 3 * 86400000;
    const day14 = 14 * 86400000;

    const activeStudents = students.filter(s => {
      if (!s.latest_activity) return false;
      return (now - new Date(s.latest_activity).getTime()) <= day3;
    });
    const inactiveStudents = students.filter(s => {
      if (!s.latest_activity) return true;
      return (now - new Date(s.latest_activity).getTime()) > day14;
    });

    const today = new Date().toDateString();
    const todaySessions = sessions.filter(s =>
      s.scheduled_at && new Date(s.scheduled_at).toDateString() === today
    );
    const upcomingSessions = sessions
      .filter(s => s.status === 'scheduled' || s.status === 'draft')
      .sort((a, b) => {
        const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
        const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 5);

    const pendingReviews = sessions.filter(s => s.status === 'completed' && !s.summary);

    return {
      total: students.length,
      active: activeStudents.length,
      inactive: inactiveStudents,
      todaySessions,
      upcomingSessions,
      pendingReviews,
    };
  }, [students, sessions]);

  return (
    <div className="space-y-5">
      {/* ── Quick Actions Row ── */}
      <div className="flex items-start gap-4 justify-center py-4">
        {[
          { icon: Plus, label: t('staff.teacher.cockpit.action_new_session', { defaultValue: 'New Session' }), onClick: onCreateSession, primary: true },
          { icon: Video, label: t('staff.teacher.cockpit.sessions_today', { defaultValue: 'Today' }), onClick: () => onSwitchTab('sessions'), badge: stats.todaySessions.length || undefined },
          { icon: Users, label: t('staff.teacher.cockpit.total_students', { defaultValue: 'Students' }), onClick: () => onSwitchTab('students'), badge: stats.total || undefined },
          { icon: CalendarDays, label: t('staff.teacher.cockpit.upcoming_sessions', { defaultValue: 'Schedule' }), onClick: () => onSwitchTab('sessions') },
        ].map((item, i) => (
          <button key={i} onClick={item.onClick} className="flex flex-col items-center gap-1.5 group w-16">
            <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all group-hover:scale-105 ${
              item.primary
                ? 'bg-[#0E71EB] text-white shadow-sm'
                : 'bg-muted/50 text-foreground/60 group-hover:bg-muted'
            }`}>
              <item.icon className="h-5 w-5" />
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[16px] h-4 rounded-full bg-[#E02828] text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Compact Stats Strip ── */}
      <div className="flex items-center justify-center gap-6 py-2">
        {[
          { v: stats.todaySessions.length, l: t('staff.teacher.cockpit.sessions_today', { defaultValue: 'Today' }), c: '#0E71EB' },
          { v: stats.total, l: t('staff.teacher.cockpit.total_students', { defaultValue: 'Students' }), c: '#2D8CFF', s: `${stats.active} ${t('staff.teacher.cockpit.active_label', { defaultValue: 'active' })}` },
          { v: stats.pendingReviews.length, l: t('staff.teacher.cockpit.pending_reviews', { defaultValue: 'Reviews' }), c: '#F5A623' },
          { v: stats.inactive.length, l: t('staff.teacher.cockpit.needs_attention', { defaultValue: 'At Risk' }), c: '#E02828' },
        ].map((s, i) => (
          <div key={i} className="text-center min-w-[60px]">
            <p className="text-xl font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
            <p className="text-[10px] text-muted-foreground">{s.l}</p>
            {s.s && <p className="text-[9px] text-muted-foreground/60">{s.s}</p>}
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Upcoming Sessions */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {t('staff.teacher.cockpit.upcoming_sessions', { defaultValue: 'Upcoming Sessions' })}
            </h3>
            <button onClick={() => onSwitchTab('sessions')} className="text-[11px] text-[#0E71EB] hover:underline flex items-center gap-0.5">
              {t('staff.teacher.cockpit.view_all', { defaultValue: 'View All' })} <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {stats.upcomingSessions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg bg-card">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-15" />
              <p className="text-xs">{t('staff.teacher.cockpit.no_upcoming', { defaultValue: 'No upcoming sessions' })}</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
              {stats.upcomingSessions.map(s => {
                return (
                  <button key={s.id} onClick={() => onSelectSession(s.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors text-start">
                    <div className="w-7 h-7 rounded-md bg-[#0E71EB]/8 flex items-center justify-center shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-[#0E71EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {t(`staff.teacher.session.type_${s.session_type}`, { defaultValue: s.session_type.replace(/_/g, ' ') })}
                      </p>
                      {(s.module_slug || s.lesson_slug) && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.module_slug}{s.lesson_slug ? ` / ${s.lesson_slug}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.scheduled_at && (
                        <SessionCountdown scheduledAt={s.scheduled_at} joinLink={s.zoom_link} compact sessionStatus={s.status} showLocalTime />
                      )}
                      <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-4 ${s.status === 'scheduled' ? 'bg-[#0E71EB]/8 text-[#0E71EB]' : ''}`}>
                        {t(`staff.teacher.session.status_${s.status}`, { defaultValue: s.status })}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* At-risk */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-[#E02828]" />
            {t('staff.teacher.cockpit.at_risk_students', { defaultValue: 'Needs Attention' })}
          </h3>

          {stats.inactive.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground border rounded-lg bg-card">
              <p className="text-xs">{t('staff.teacher.cockpit.all_active', { defaultValue: 'All students are active' })}</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
              {stats.inactive.slice(0, 5).map(s => {
                const daysSince = s.latest_activity
                  ? Math.floor((Date.now() - new Date(s.latest_activity).getTime()) / 86400000)
                  : null;
                return (
                  <button key={s.user_id} onClick={() => onSelectStudent(s.user_id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors text-start">
                    <div className="w-6 h-6 rounded-full bg-[#E02828]/8 flex items-center justify-center shrink-0">
                      <UserX className="h-3 w-3 text-[#E02828]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{s.full_name || t('staff.teacher.unnamed', { defaultValue: 'Unnamed' })}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {daysSince !== null
                          ? t('staff.teacher.cockpit.days_inactive', { defaultValue: '{{days}}d inactive', days: daysSince })
                          : t('staff.teacher.cockpit.never_active', { defaultValue: 'Never active' })}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </button>
                );
              })}
              {stats.inactive.length > 5 && (
                <button onClick={() => onSwitchTab('students')} className="w-full px-3 py-2 text-[11px] text-[#0E71EB] font-medium hover:bg-muted/30">
                  {t('staff.teacher.cockpit.view_all_at_risk', { defaultValue: 'View all {{count}}', count: stats.inactive.length })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
