/**
 * TeacherSessionList — Session list with List, Kanban, and Calendar views.
 * Calendar view mimics Google Calendar with day/week/month modes.
 */
import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeacherSessions } from '@/hooks/useTeacherSessions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/PageLoader';
import { Calendar as CalendarIcon, RefreshCw, Users, Video, BookOpen, Clock, Filter, LayoutGrid, List, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { SessionCountdown } from '@/components/ui/SessionCountdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { TeacherSession } from '@/hooks/useTeacherSessions';

interface Props {
  onSelectSession: (sessionId: string) => void;
}

const STATUS_FILTERS = ['all', 'draft', 'scheduled', 'live', 'completed', 'cancelled'] as const;
const KANBAN_COLUMNS = ['draft', 'scheduled', 'live', 'completed'] as const;
type ViewMode = 'list' | 'kanban' | 'calendar';
type CalendarMode = 'day' | 'week' | 'month';

// ── Helpers ──
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr} ${ampm}`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted-foreground/20',
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  live: 'bg-destructive/10 text-destructive border-destructive/30',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  cancelled: 'bg-muted/50 text-muted-foreground/60 border-muted-foreground/10 line-through',
};

export function TeacherSessionList({ onSelectSession }: Props) {
  const { t } = useLanguage();
  const { sessions, loading, error, refresh } = useTeacherSessions();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return sessions;
    return sessions.filter(s => s.status === statusFilter);
  }, [sessions, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) counts[s.status] = (counts[s.status] || 0) + 1;
    return counts;
  }, [sessions]);

  const kanbanData = useMemo(() => {
    const data: Record<string, TeacherSession[]> = {};
    for (const col of KANBAN_COLUMNS) data[col] = sessions.filter(s => s.status === col);
    return data;
  }, [sessions]);

  // Calendar navigation
  const navigate = useCallback((dir: -1 | 1) => {
    setCurrentDate(prev => {
      if (calendarMode === 'day') return addDays(prev, dir);
      if (calendarMode === 'week') return addDays(prev, dir * 7);
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  }, [calendarMode]);

  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const statusVariant = useCallback((s: string) => {
    if (s === 'completed') return 'default' as const;
    if (s === 'live') return 'destructive' as const;
    if (s === 'cancelled') return 'outline' as const;
    return 'secondary' as const;
  }, []);

  // ── Calendar title ──
  const calendarTitle = useMemo(() => {
    if (calendarMode === 'day') return currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (calendarMode === 'week') {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      return `${ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }, [currentDate, calendarMode]);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="ghost" size="sm" onClick={refresh} className="mt-2">
          <RefreshCw className="h-4 w-4 me-2" />
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('staff.teacher.session.no_sessions', { defaultValue: 'No sessions yet.' })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {viewMode !== 'calendar' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8">
                <Filter className="h-3.5 w-3.5 me-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(s => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? t('staff.teacher.session.filter_all', { defaultValue: 'All' }) : t(`staff.teacher.session.status_${s}`, { defaultValue: s })}
                    {s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {viewMode === 'calendar' && (
            <>
              <Button variant="outline" size="sm" className="h-8" onClick={goToday}>
                {t('common.today', { defaultValue: 'Today' })}
              </Button>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm font-semibold text-foreground min-w-[180px]">{calendarTitle}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'calendar' && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              {(['day', 'week', 'month'] as CalendarMode[]).map(m => (
                <Button key={m} variant={calendarMode === m ? 'default' : 'ghost'} size="sm" className="rounded-none h-8 text-xs px-3" onClick={() => setCalendarMode(m)}>
                  {t(`common.calendar_${m}`, { defaultValue: m.charAt(0).toUpperCase() + m.slice(1) })}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewMode('kanban')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewMode('calendar')}>
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Calendar View ── */}
      {viewMode === 'calendar' && (
        <CalendarView
          sessions={sessions}
          mode={calendarMode}
          currentDate={currentDate}
          onSelectSession={onSelectSession}
          t={t}
        />
      )}

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => (
            <div key={col} className="rounded-xl border-2 border-border p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">{t(`staff.teacher.session.status_${col}`, { defaultValue: col })}</h3>
                <Badge variant="secondary" className="text-xs">{kanbanData[col]?.length || 0}</Badge>
              </div>
              <div className="space-y-2">
                {(kanbanData[col] || []).map(s => (
                  <Card key={s.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => onSelectSession(s.id)}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{t(`staff.teacher.session.type_${s.session_type}`, { defaultValue: s.session_type.replace(/_/g, ' ') })}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {s.students && s.students.length > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.students.length}</span>}
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!kanbanData[col] || kanbanData[col].length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4 opacity-50">{t('staff.teacher.session.kanban_empty', { defaultValue: 'No sessions' })}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filtered.map(s => (
            <Card key={s.id} className="cursor-pointer hover:bg-muted/30 hover:shadow-sm transition-all" onClick={() => onSelectSession(s.id)}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.status === 'live' ? 'bg-destructive/10' : s.status === 'completed' ? 'bg-primary/10' : 'bg-muted'}`}>
                      <BookOpen className={`h-5 w-5 ${s.status === 'live' ? 'text-destructive' : s.status === 'completed' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(`staff.teacher.session.type_${s.session_type}`, { defaultValue: s.session_type.replace(/_/g, ' ') })}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.module_slug && <span className="text-xs text-muted-foreground">{s.module_slug}{s.lesson_slug && ` / ${s.lesson_slug}`}</span>}
                        {s.students && s.students.length > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{s.students.length}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.zoom_link && <Video className="h-4 w-4 text-primary" />}
                    <Badge variant={statusVariant(s.status)} className="text-xs">{t(`staff.teacher.session.status_${s.status}`, { defaultValue: s.status })}</Badge>
                    {(s.status === 'scheduled' || s.status === 'draft') && s.scheduled_at ? (
                      <SessionCountdown scheduledAt={s.scheduled_at} joinLink={s.zoom_link} compact sessionStatus={s.status} showLocalTime />
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString() : new Date(s.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// Calendar View Component
// ══════════════════════════════════════

function CalendarView({
  sessions, mode, currentDate, onSelectSession, t
}: {
  sessions: TeacherSession[];
  mode: CalendarMode;
  currentDate: Date;
  onSelectSession: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (mode === 'month') return <MonthView sessions={sessions} currentDate={currentDate} onSelectSession={onSelectSession} t={t} />;
  // Day & Week share the time grid
  return <TimeGridView sessions={sessions} currentDate={currentDate} mode={mode} onSelectSession={onSelectSession} t={t} />;
}

// ── Time Grid (Day / Week) ──
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // px per hour

function TimeGridView({ sessions, currentDate, mode, onSelectSession, t }: {
  sessions: TeacherSession[];
  currentDate: Date;
  mode: 'day' | 'week';
  onSelectSession: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const days = useMemo(() => {
    if (mode === 'day') return [currentDate];
    const ws = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [currentDate, mode]);

  const today = new Date();

  // Map sessions by day key
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, TeacherSession[]>();
    for (const s of sessions) {
      if (!s.scheduled_at) continue;
      const d = new Date(s.scheduled_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  // Current time indicator position
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Day headers */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
        <div className="p-2 border-e border-border" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`p-2 text-center border-e border-border last:border-e-0 ${isToday ? 'bg-primary/5' : ''}`}>
              <div className="text-[11px] text-muted-foreground uppercase">
                {day.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div className={`text-lg font-bold mt-0.5 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto' : 'text-foreground'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <ScrollArea className="h-[600px]">
        <div className="relative grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map(h => (
              <div key={h} className="border-b border-border flex items-start justify-end pe-2 pt-1 text-[11px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const daySessions = sessionsByDay.get(key) || [];
            const isToday = isSameDay(day, today);
            return (
              <div key={di} className={`relative border-e border-border last:border-e-0 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} className="border-b border-border" style={{ height: HOUR_HEIGHT }} />
                ))}
                {/* Now indicator */}
                {isToday && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive -ms-1" />
                      <div className="flex-1 h-[2px] bg-destructive" />
                    </div>
                  </div>
                )}
                {/* Session events */}
                {daySessions.map(s => <TimeGridEvent key={s.id} session={s} onSelect={onSelectSession} t={t} />)}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function TimeGridEvent({ session, onSelect, t }: { session: TeacherSession; onSelect: (id: string) => void; t: (k: string, opts?: Record<string, unknown>) => string }) {
  const d = new Date(session.scheduled_at!);
  const startMin = d.getHours() * 60 + d.getMinutes();
  const top = (startMin / 60) * HOUR_HEIGHT;
  const duration = 50; // default 50min
  const height = Math.max((duration / 60) * HOUR_HEIGHT, 28);
  const colorClass = STATUS_COLORS[session.status] || STATUS_COLORS.draft;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`absolute inset-x-1 z-10 rounded-md border px-1.5 py-0.5 text-start cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] overflow-hidden ${colorClass}`}
            style={{ top, height, minHeight: 28 }}
            onClick={() => onSelect(session.id)}
          >
            <p className="text-[11px] font-semibold truncate leading-tight">
              {t(`staff.teacher.session.type_${session.session_type}`, { defaultValue: session.session_type.replace(/_/g, ' ') })}
            </p>
            <p className="text-[10px] opacity-70 truncate">
              {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {session.students && session.students.length > 0 && ` · ${session.students.length} 👤`}
            </p>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{t(`staff.teacher.session.type_${session.session_type}`, { defaultValue: session.session_type.replace(/_/g, ' ') })}</p>
            <p className="text-xs">{d.toLocaleString()}</p>
            {session.module_slug && <p className="text-xs text-muted-foreground">{session.module_slug}{session.lesson_slug && ` / ${session.lesson_slug}`}</p>}
            {session.zoom_link && <p className="text-xs text-primary flex items-center gap-1"><Video className="h-3 w-3" />{t('common.join', { defaultValue: 'Join' })}</p>}
            {(session.status === 'scheduled') && session.scheduled_at && (
              <SessionCountdown scheduledAt={session.scheduled_at} compact sessionStatus={session.status} showLocalTime />
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Month View ──
function MonthView({ sessions, currentDate, onSelectSession, t }: {
  sessions: TeacherSession[];
  currentDate: Date;
  onSelectSession: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday of the week containing the 1st
  const startDate = startOfWeek(firstDay);
  const weeks: Date[][] = [];
  let cursor = new Date(startDate);
  while (cursor <= lastDay || weeks.length < 5) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (weeks.length >= 6) break;
  }

  // Map sessions by date key
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, TeacherSession[]>();
    for (const s of sessions) {
      if (!s.scheduled_at) continue;
      const d = new Date(s.scheduled_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i).toLocaleDateString(undefined, { weekday: 'short' }));
  }, []);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((wd, i) => (
          <div key={i} className="p-2 text-center text-[11px] text-muted-foreground uppercase font-medium border-e border-border last:border-e-0">
            {wd}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0" style={{ minHeight: 100 }}>
          {week.map((day, di) => {
            const isCurrentMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const daySessions = sessionsByDay.get(key) || [];

            return (
              <div key={di} className={`border-e border-border last:border-e-0 p-1 ${isCurrentMonth ? '' : 'bg-muted/30'}`}>
                <div className={`text-xs mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto font-bold' : isCurrentMonth ? 'text-foreground text-center' : 'text-muted-foreground/50 text-center'}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {daySessions.slice(0, 3).map(s => {
                    const colorClass = STATUS_COLORS[s.status] || STATUS_COLORS.draft;
                    const time = new Date(s.scheduled_at!).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    return (
                      <button
                        key={s.id}
                        className={`w-full text-start rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border ${colorClass}`}
                        onClick={() => onSelectSession(s.id)}
                      >
                        {time} {t(`staff.teacher.session.type_${s.session_type}`, { defaultValue: s.session_type.replace(/_/g, ' ') })}
                      </button>
                    );
                  })}
                  {daySessions.length > 3 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{daySessions.length - 3} {t('common.more', { defaultValue: 'more' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
