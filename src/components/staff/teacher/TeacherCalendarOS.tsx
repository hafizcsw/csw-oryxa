/**
 * TeacherCalendarOS — Full teacher calendar operating system.
 * Contains: Rules editor, Calendar view, Assistant, Reminders.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { startOfWeek } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeacherAvailability, type AvailabilityRule, type AvailabilityException } from '@/hooks/useTeacherAvailability';
import type { TeacherSession } from '@/hooks/useTeacherSessions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SessionCountdown } from '@/components/ui/SessionCountdown';
import { PageLoader } from '@/components/ui/PageLoader';
import { CalendarAssistant } from './CalendarAssistant';
import { toast } from 'sonner';
import {
  CalendarClock, Clock, Plus, X, Save, Settings2, AlertTriangle,
  ChevronLeft, ChevronRight, Users, Video, Ban, Check, Bot,
  Bell, Shield, Loader2, CalendarDays, List, Pencil, LayoutGrid, BookOpen, Filter, Globe, Sparkles
} from 'lucide-react';


const DAY_KEYS = [
  'common.days.sunday', 'common.days.monday', 'common.days.tuesday',
  'common.days.wednesday', 'common.days.thursday', 'common.days.friday', 'common.days.saturday'
];
const DAY_DEFAULTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIMEZONES = [
  'Asia/Dubai', 'Asia/Riyadh', 'Europe/Moscow', 'Europe/London',
  'America/New_York', 'Asia/Tashkent', 'Europe/Istanbul', 'Africa/Cairo',
  'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'America/Los_Angeles',
  'Europe/Berlin', 'Europe/Paris', 'America/Sao_Paulo',
];

const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ampm}`;
}
function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(p => p.type === 'year')?.value || '0000';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}
function getMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0');
  return hour * 60 + minute;
}
function formatTimeInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
function formatDateTimeInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
function formatWeekdayShortInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'short' }).format(date);
}
function formatDayInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, day: 'numeric' }).format(date);
}
function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getDay();
}
function isTodayInTimeZone(date: Date, timeZone: string): boolean {
  return getDateKeyInTimeZone(date, timeZone) === getDateKeyInTimeZone(new Date(), timeZone);
}

interface Props {
  onSelectSession?: (sessionId: string) => void;
  sessions?: TeacherSession[];
}

interface CalendarSessionItem {
  id: string;
  scheduled_at: string;
  status: string;
  session_type: string;
  zoom_link?: string | null;
  students?: Array<{ student_user_id?: string; full_name?: string | null }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted-foreground/20',
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  live: 'bg-destructive/10 text-destructive border-destructive/30',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  cancelled: 'bg-muted/50 text-muted-foreground/60 border-muted-foreground/10 line-through',
};
const KANBAN_COLUMNS = ['draft', 'scheduled', 'live', 'completed'] as const;
const STATUS_FILTERS = ['all', 'draft', 'scheduled', 'live', 'completed', 'cancelled'] as const;

export function TeacherCalendarOS({ onSelectSession, sessions: externalSessions }: Props) {
  const { t, language } = useLanguage();
  const avail = useTeacherAvailability();
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('week');
  const [viewStyle, setViewStyle] = useState<'calendar' | 'list' | 'kanban'>('calendar');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAssistant, setShowAssistant] = useState(false);
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    conflicts: any[];
    action: string;
    onConfirm: () => void;
  }>({ open: false, conflicts: [], action: '', onConfirm: () => {} });

  // Calendar navigation
  const navigateCal = useCallback((dir: -1 | 1) => {
    setCalendarDate(prev => {
      if (calendarMode === 'day') return addDays(prev, dir);
      if (calendarMode === 'week') return addDays(prev, dir * 7);
      const d = new Date(prev); d.setMonth(d.getMonth() + dir); return d;
    });
  }, [calendarMode]);

  const weekDays = useMemo(() => {
    if (calendarMode === 'day') return [calendarDate];
    if (calendarMode === 'month') {
      // For month mode, not used for grid but we still need it for slot generation
      const first = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
      const last = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
      return [first, last];
    }
    const start = startOfDay(calendarDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [calendarDate, calendarMode]);

  const calendarTitle = useMemo(() => {
    if (calendarMode === 'day') return calendarDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (calendarMode === 'month') return calendarDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    const start = startOfDay(calendarDate);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [calendarDate, calendarMode]);

  // All sessions (external prop or from availability hook)
  const allSessions = externalSessions || [];
  const calendarTimeZone = avail.preferences.timezone || 'Asia/Dubai';

  const mergedSessionsForCalendar = useMemo<CalendarSessionItem[]>(() => {
    const studentsBySession = new Map(avail.bookedSessions.map(s => [s.id, s.students || []]));
    return allSessions
      .filter(s => !!s.scheduled_at && ['draft', 'scheduled', 'live'].includes(s.status))
      .map((s) => ({
        id: s.id,
        scheduled_at: s.scheduled_at!,
        status: s.status,
        session_type: s.session_type,
        zoom_link: s.zoom_link,
        students: (s.students && s.students.length > 0)
          ? s.students.filter(Boolean).map(st => ({ student_user_id: st?.student_user_id, full_name: st?.full_name }))
          : (studentsBySession.get(s.id) || []).filter(Boolean).map(st => ({ student_user_id: st?.student_user_id, full_name: st?.full_name })),
      }));
  }, [allSessions, avail.bookedSessions]);
  
  const filteredSessions = useMemo(() => {
    if (statusFilter === 'all') return allSessions;
    return allSessions.filter(s => s.status === statusFilter);
  }, [allSessions, statusFilter]);

  const kanbanData = useMemo(() => {
    const data: Record<string, TeacherSession[]> = {};
    for (const col of KANBAN_COLUMNS) data[col] = allSessions.filter(s => s.status === col);
    return data;
  }, [allSessions]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSessions) counts[s.status] = (counts[s.status] || 0) + 1;
    return counts;
  }, [allSessions]);

  // Generated slots for calendar view
  const calendarSlots = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    return avail.generateSlots(start, end);
  }, [weekDays, avail.generateSlots]);

  // Live clock
  const [clockTime, setClockTime] = useState('');
  const [clockDate, setClockDate] = useState('');
  useEffect(() => {
    const tick = () => {
      const tz = avail.preferences.timezone || 'Asia/Dubai';
      const now = new Date();
      setClockTime(now.toLocaleTimeString(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setClockDate(now.toLocaleDateString(undefined, { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [avail.preferences.timezone]);

  if (avail.loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* ── Live Clock + Timezone ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold tabular-nums tracking-tight">{clockTime}</span>
          </div>
          <span className="text-sm text-muted-foreground">{clockDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={avail.preferences.timezone || 'Asia/Dubai'} onValueChange={async (tz) => {
            await avail.savePreferences({ ...avail.preferences, timezone: tz });
          }}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => <SelectItem key={tz} value={tz} className="text-xs">{tz.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* ── Main Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {t('staff.teacher.calendar.tab_calendar', { defaultValue: 'Calendar' })}
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Clock className="h-4 w-4" />
              {t('staff.teacher.calendar.tab_rules', { defaultValue: 'Availability Rules' })}
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="gap-1.5">
              <Ban className="h-4 w-4" />
              {t('staff.teacher.calendar.tab_exceptions', { defaultValue: 'Exceptions' })}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="h-4 w-4" />
              {t('staff.teacher.calendar.tab_settings', { defaultValue: 'Settings' })}
            </TabsTrigger>
          </TabsList>
          <div className="relative">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAssistant(!showAssistant)}>
              <Bot className="h-4 w-4" />
              {t('staff.teacher.calendar.assistant', { defaultValue: 'Calendar Assistant' })}
            </Button>

            {showAssistant && (
              <div className="absolute top-full mt-2 end-0 w-[380px] max-w-[92vw] z-50 flex flex-col bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden h-[min(70vh,680px)]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('staff.teacher.calendar.assistant', { defaultValue: 'Calendar Assistant' })}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowAssistant(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CalendarAssistant
                    rules={avail.rules}
                    exceptions={avail.exceptions}
                    preferences={avail.preferences}
                    bookedSessions={avail.bookedSessions}
                    onRulesChange={avail.saveRules}
                    onAddException={avail.addException}
                    onRemoveExceptionsByDate={avail.removeExceptionsByDate}
                    onPreferencesChange={avail.savePreferences}
                    onRefresh={avail.refresh}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CALENDAR TAB ═══ */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {/* Navigation */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {viewStyle === 'calendar' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())}>
                        {t('common.today', { defaultValue: 'Today' })}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateCal(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateCal(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-semibold">{calendarTitle}</span>
                    </>
                  )}
                  {viewStyle !== 'calendar' && (
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
                </div>
                <div className="flex items-center gap-2">
                  {viewStyle === 'calendar' && (
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      {(['day', 'week', 'month'] as const).map(m => (
                        <Button key={m} variant={calendarMode === m ? 'default' : 'ghost'} size="sm" className="rounded-none h-8 text-xs px-3" onClick={() => setCalendarMode(m)}>
                          {t(`common.calendar_${m}`, { defaultValue: m.charAt(0).toUpperCase() + m.slice(1) })}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <Button variant={viewStyle === 'calendar' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewStyle('calendar')}>
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                    <Button variant={viewStyle === 'kanban' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewStyle('kanban')}>
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewStyle === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8" onClick={() => setViewStyle('list')}>
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Calendar Time Grid (Day/Week) ── */}
              {viewStyle === 'calendar' && calendarMode !== 'month' && (
                <>
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="grid border-b border-border" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}>
                      <div className="p-2 border-e border-border" />
                      {weekDays.map((day, i) => {
                        const isToday = isTodayInTimeZone(day, calendarTimeZone);
                        return (
                          <div key={i} className={`p-2 text-center border-e border-border last:border-e-0 ${isToday ? 'bg-primary/5' : ''}`}>
                            <div className="text-[11px] text-muted-foreground uppercase">{formatWeekdayShortInTimeZone(day, calendarTimeZone)}</div>
                            <div className={`text-lg font-bold mt-0.5 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto' : 'text-foreground'}`}>{formatDayInTimeZone(day, calendarTimeZone)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <ScrollArea className="h-[600px]">
                      <div className="relative grid" style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}>
                        <div className="relative">
                          {HOURS.map(h => (
                            <div key={h} className="border-b border-border flex items-start justify-end pe-2 pt-1 text-[11px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>{formatHour(h)}</div>
                          ))}
                        </div>
                        {weekDays.map((day, di) => {
                          const dateStr = getDateKeyInTimeZone(day, calendarTimeZone);
                          const isToday = isTodayInTimeZone(day, calendarTimeZone);
                          const dayRules = avail.rules.filter(r => r.day_of_week === getDayOfWeekInTimeZone(day, calendarTimeZone));
                          const dayExceptions = avail.exceptions.filter(e => e.exception_date === dateStr);
                          const isFullBlackout = dayExceptions.some(e => e.exception_type === 'blackout' && !e.start_time);
                          const daySessions = mergedSessionsForCalendar.filter(s => {
                            if (!s.scheduled_at) return false;
                            return getDateKeyInTimeZone(new Date(s.scheduled_at), calendarTimeZone) === dateStr;
                          });

                          return (
                            <div key={di} className={`relative border-e border-border last:border-e-0 ${isToday ? 'bg-[#E8F0FE]' : ''} ${isFullBlackout ? 'bg-[#FDEDED]' : ''}`}>
                              {HOURS.map(h => (<div key={h} className="border-b border-border" style={{ height: HOUR_HEIGHT }} />))}
                              {dayRules.map((rule, ri) => {
                                const [sh, sm] = rule.start_time.split(':').map(Number);
                                const [eh, em] = rule.end_time.split(':').map(Number);
                                const top = (sh * 60 + sm) / 60 * HOUR_HEIGHT;
                                const height = ((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_HEIGHT;
                                return <div key={`avail-${ri}`} className="absolute inset-x-0.5 z-[1] rounded-sm bg-[#E6F4EA] border border-[#33B679]/30" style={{ top, height }} />;
                              })}
                              {isFullBlackout && (
                                <div className="absolute inset-0 z-[2] bg-[#D50000]/5 flex items-center justify-center">
                                  <Badge variant="outline" className="text-[10px] bg-[#D50000]/10 text-[#D50000] border-[#D50000]/20">{t('staff.teacher.calendar.blackout', { defaultValue: 'Blocked' })}</Badge>
                                </div>
                              )}
                              {isToday && (() => {
                                const nowTop = getMinutesInTimeZone(new Date(), calendarTimeZone) / 60 * HOUR_HEIGHT;
                                return (
                                  <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                                    <div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#EA4335] -ms-1" /><div className="flex-1 h-[2px] bg-[#EA4335]" /></div>
                                  </div>
                                );
                              })()}
                              {daySessions.map(session => {
                                const dt = new Date(session.scheduled_at!);
                                const startMin = getMinutesInTimeZone(dt, calendarTimeZone);
                                const top = (startMin / 60) * HOUR_HEIGHT;
                                const duration = avail.preferences.default_session_duration;
                                const height = Math.max((duration / 60) * HOUR_HEIGHT, 32);
                                const studentNames = (session.students || []).map(s => s.full_name || '?').join(', ');
                                return (
                                  <TooltipProvider key={session.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="absolute inset-x-1 z-10 rounded-md border bg-[#039BE5]/15 border-[#039BE5]/30 text-[#039BE5] px-1.5 py-0.5 text-start cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all overflow-hidden" style={{ top, height, minHeight: 32 }} onClick={() => onSelectSession?.(session.id)}>
                                          <p className="text-[11px] font-semibold truncate leading-tight flex items-center gap-1"><Users className="h-3 w-3 shrink-0" />{studentNames || t('staff.teacher.calendar.session', { defaultValue: 'Session' })}</p>
                                          <p className="text-[10px] opacity-70 truncate">{formatTimeInTimeZone(dt, calendarTimeZone)}{session.zoom_link && ' 📹'}</p>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="max-w-[240px]">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-sm">{session.session_type.replace(/_/g, ' ')}</p>
                                          <p className="text-xs">{formatDateTimeInTimeZone(dt, calendarTimeZone)}</p>
                                          <p className="text-xs">{studentNames}</p>
                                          <SessionCountdown scheduledAt={session.scheduled_at!} compact sessionStatus={session.status} />
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                   <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#E6F4EA] border border-[#33B679]/30" />{t('staff.teacher.calendar.legend_available', { defaultValue: 'Available' })}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#039BE5]/15 border border-[#039BE5]/30" />{t('staff.teacher.calendar.legend_booked', { defaultValue: 'Booked' })}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#D50000]/10 border border-[#D50000]/20" />{t('staff.teacher.calendar.legend_blocked', { defaultValue: 'Blocked' })}</span>
                  </div>
                </>
              )}

              {/* ── Month View ── */}
              {viewStyle === 'calendar' && calendarMode === 'month' && (
                <MonthCalendarView sessions={mergedSessionsForCalendar} currentDate={calendarDate} timezone={calendarTimeZone} onSelectSession={(id) => onSelectSession?.(id)} t={t} />
              )}

              {/* ── Kanban View ── */}
              {viewStyle === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {KANBAN_COLUMNS.map(col => (
                    <div key={col} className="rounded-xl border-2 border-border p-3 min-h-[200px]">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold">{t(`staff.teacher.session.status_${col}`, { defaultValue: col })}</h3>
                        <Badge variant="secondary" className="text-xs">{kanbanData[col]?.length || 0}</Badge>
                      </div>
                      <div className="space-y-2">
                        {(kanbanData[col] || []).map(s => (
                          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => onSelectSession?.(s.id)}>
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
              {viewStyle === 'list' && (
                <div className="space-y-3">
                  {filteredSessions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('staff.teacher.session.no_sessions', { defaultValue: 'No sessions yet.' })}</p>
                  )}
                  {filteredSessions.map(s => (
                    <Card key={s.id} className="cursor-pointer hover:bg-muted/30 hover:shadow-sm transition-all" onClick={() => onSelectSession?.(s.id)}>
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
                            <Badge variant={s.status === 'completed' ? 'default' : s.status === 'live' ? 'destructive' : s.status === 'cancelled' ? 'outline' : 'secondary'} className="text-xs">
                              {t(`staff.teacher.session.status_${s.status}`, { defaultValue: s.status })}
                            </Badge>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RULES TAB ═══ */}
        <TabsContent value="rules" className="mt-4">
          <RulesEditor
            rules={avail.rules}
            onSave={async (newRules) => {
              await avail.saveRules(newRules);
              toast.success(t('staff.teacher.calendar.rules_saved', { defaultValue: 'Availability rules saved' }));
            }}
            saving={avail.saving}
            t={t}
          />
        </TabsContent>

        {/* ═══ EXCEPTIONS TAB ═══ */}
        <TabsContent value="exceptions" className="mt-4">
          <ExceptionsEditor
            exceptions={avail.exceptions}
            onAdd={avail.addException}
            onRemove={avail.removeException}
            detectConflicts={avail.detectConflicts}
            t={t}
          />
        </TabsContent>

        {/* ═══ SETTINGS TAB ═══ */}
        <TabsContent value="settings" className="mt-4">
          <PreferencesEditor
            preferences={avail.preferences}
            onSave={async (prefs) => {
              await avail.savePreferences(prefs);
              toast.success(t('staff.teacher.calendar.settings_saved', { defaultValue: 'Settings saved' }));
            }}
            saving={avail.saving}
            t={t}
          />
        </TabsContent>
      </Tabs>


      {/* ── Conflict Dialog ── */}
      <Dialog open={conflictDialog.open} onOpenChange={(open) => setConflictDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('staff.teacher.calendar.conflict_title', { defaultValue: 'Schedule Conflict Detected' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('staff.teacher.calendar.conflict_desc', { defaultValue: 'This change affects existing booked sessions:' })}
            </p>
            {conflictDialog.conflicts.map((c: any, i: number) => (
              <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium">{c.session?.students?.map((s: any) => s.full_name).join(', ')}</p>
                <p className="text-xs text-muted-foreground">{c.overlapStart} - {c.overlapEnd}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConflictDialog(prev => ({ ...prev, open: false }))}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant="destructive" onClick={() => {
              conflictDialog.onConfirm();
              setConflictDialog(prev => ({ ...prev, open: false }));
            }}>
              {t('staff.teacher.calendar.conflict_proceed', { defaultValue: 'Proceed Anyway' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════
// Rules Editor
// ══════════════════════════════════════
function RulesEditor({ rules, onSave, saving, t }: {
  rules: AvailabilityRule[];
  onSave: (rules: AvailabilityRule[]) => Promise<void>;
  saving: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const [editRules, setEditRules] = useState<AvailabilityRule[]>(rules);
  const [dirty, setDirty] = useState(false);

  const addRule = (day: number) => {
    setEditRules(prev => [...prev, { day_of_week: day, start_time: '09:00', end_time: '17:00', is_active: true }]);
    setDirty(true);
  };

  const removeRule = (index: number) => {
    setEditRules(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateRule = (index: number, field: string, value: string) => {
    setEditRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t('staff.teacher.calendar.rules_title', { defaultValue: 'Weekly Availability Rules' })}
          </h3>
          <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(editRules).then(() => setDirty(false))} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('staff.teacher.calendar.rules_hint', { defaultValue: 'Define your recurring weekly schedule. Add multiple time ranges per day.' })}
        </p>

        {Array.from({ length: 7 }, (_, day) => {
          const dayRules = editRules.map((r, i) => ({ ...r, _index: i })).filter(r => r.day_of_week === day);
          return (
            <div key={day} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">
                  {t(DAY_KEYS[day], { defaultValue: DAY_DEFAULTS[day] })}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => addRule(day)}>
                  <Plus className="h-3 w-3" />
                  {t('staff.teacher.calendar.add_range', { defaultValue: 'Add Range' })}
                </Button>
              </div>
              {dayRules.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  {t('staff.teacher.calendar.no_rules_day', { defaultValue: 'No availability set' })}
                </p>
              )}
              <div className="space-y-2">
                {dayRules.map(r => (
                  <div key={r._index} className="flex items-center gap-2">
                    <Select value={r.start_time} onValueChange={v => updateRule(r._index, 'start_time', v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-48">
                        {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Select value={r.end_time} onValueChange={v => updateRule(r._index, 'end_time', v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-48">
                        {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRule(r._index)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════
// Exceptions Editor
// ══════════════════════════════════════
function ExceptionsEditor({ exceptions, onAdd, onRemove, detectConflicts, t }: {
  exceptions: AvailabilityException[];
  onAdd: (e: Omit<AvailabilityException, 'id' | 'user_id'>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  detectConflicts: (date: string, start: string, end: string) => any[];
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<AvailabilityException['exception_type']>('blackout');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');

  const handleAdd = async () => {
    if (!newDate) return;

    // Detect conflicts if blackout
    if (newType === 'blackout') {
      const start = newStart || '00:00';
      const end = newEnd || '23:59';
      const conflicts = detectConflicts(newDate, start, end);
      if (conflicts.length > 0) {
        const studentNames = conflicts.map(c => c.session?.students?.map((s: any) => s.full_name).join(', ')).join('; ');
        const proceed = window.confirm(
          t('staff.teacher.calendar.conflict_warning', {
            defaultValue: `This blocks time with existing sessions (${studentNames}). Proceed?`,
            students: studentNames,
          })
        );
        if (!proceed) return;
      }
    }

    await onAdd({
      exception_date: newDate,
      start_time: newStart || null,
      end_time: newEnd || null,
      exception_type: newType,
      reason: newReason || undefined,
    });
    setNewDate('');
    setNewStart('');
    setNewEnd('');
    setNewReason('');
    toast.success(t('staff.teacher.calendar.exception_added', { defaultValue: 'Exception added' }));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Ban className="h-5 w-5 text-destructive" />
          {t('staff.teacher.calendar.exceptions_title', { defaultValue: 'Exceptions & Blackout Dates' })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('staff.teacher.calendar.exceptions_hint', { defaultValue: 'Add one-off schedule changes: blackout days, extra availability, or time overrides.' })}
        </p>

        {/* Add new */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">{t('staff.teacher.calendar.date', { defaultValue: 'Date' })}</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">{t('staff.teacher.calendar.type', { defaultValue: 'Type' })}</Label>
              <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blackout" className="text-xs">{t('staff.teacher.calendar.blackout', { defaultValue: 'Blackout' })}</SelectItem>
                  <SelectItem value="override_available" className="text-xs">{t('staff.teacher.calendar.override_available', { defaultValue: 'Extra Available' })}</SelectItem>
                  <SelectItem value="override_unavailable" className="text-xs">{t('staff.teacher.calendar.override_unavailable', { defaultValue: 'Unavailable' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('staff.teacher.calendar.start_time', { defaultValue: 'Start' })}</Label>
              <Select value={newStart} onValueChange={setNewStart}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('staff.teacher.calendar.all_day', { defaultValue: 'All day' })} /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('staff.teacher.calendar.end_time', { defaultValue: 'End' })}</Label>
              <Select value={newEnd} onValueChange={setNewEnd}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('staff.teacher.calendar.all_day', { defaultValue: 'All day' })} /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {HOUR_OPTIONS.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder={t('staff.teacher.calendar.reason_placeholder', { defaultValue: 'Reason (optional)' })}
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newDate} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              {t('common.add', { defaultValue: 'Add' })}
            </Button>
          </div>
        </div>

        {/* Existing exceptions */}
        <div className="space-y-2">
          {exceptions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('staff.teacher.calendar.no_exceptions', { defaultValue: 'No exceptions set' })}</p>
          )}
          {exceptions.map(e => (
            <div key={e.id} className={`flex items-center justify-between rounded-lg border p-3 ${
              e.exception_type === 'blackout' ? 'border-destructive/20 bg-destructive/5' :
              e.exception_type === 'override_available' ? 'border-primary/20 bg-primary/5' :
              'border-amber-500/20 bg-amber-500/5'
            }`}>
              <div>
                <p className="text-sm font-medium">
                  {new Date(e.exception_date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {e.start_time && e.end_time && ` · ${e.start_time} - ${e.end_time}`}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">
                    {t(`staff.teacher.calendar.${e.exception_type}`, { defaultValue: e.exception_type })}
                  </Badge>
                  {e.reason && <span className="text-xs text-muted-foreground">{e.reason}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => e.id && onRemove(e.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════
// Preferences Editor
// ══════════════════════════════════════
function PreferencesEditor({ preferences, onSave, saving, t }: {
  preferences: any;
  onSave: (prefs: any) => Promise<void>;
  saving: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const [prefs, setPrefs] = useState(preferences);
  const [dirty, setDirty] = useState(false);

  const update = (field: string, value: any) => {
    setPrefs((prev: any) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {t('staff.teacher.calendar.settings_title', { defaultValue: 'Calendar Settings' })}
          </h3>
          <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(prefs).then(() => setDirty(false))} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">{t('staff.teacher.calendar.timezone', { defaultValue: 'Timezone' })}</Label>
            <Select value={prefs.timezone} onValueChange={v => update('timezone', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{t('staff.teacher.calendar.default_duration', { defaultValue: 'Default Session Duration (min)' })}</Label>
            <Select value={String(prefs.default_session_duration)} onValueChange={v => update('default_session_duration', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 30, 40, 45, 50, 60, 90].map(d => <SelectItem key={d} value={String(d)}>{d} {t('common.minutes', { defaultValue: 'min' })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{t('staff.teacher.calendar.buffer_before', { defaultValue: 'Buffer Before Session (min)' })}</Label>
            <Select value={String(prefs.buffer_before_minutes)} onValueChange={v => update('buffer_before_minutes', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 20, 30].map(d => <SelectItem key={d} value={String(d)}>{d} {t('common.minutes', { defaultValue: 'min' })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{t('staff.teacher.calendar.buffer_after', { defaultValue: 'Buffer After Session (min)' })}</Label>
            <Select value={String(prefs.buffer_after_minutes)} onValueChange={v => update('buffer_after_minutes', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 5, 10, 15, 20, 30].map(d => <SelectItem key={d} value={String(d)}>{d} {t('common.minutes', { defaultValue: 'min' })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{t('staff.teacher.calendar.max_sessions', { defaultValue: 'Max Sessions Per Day' })}</Label>
            <Select value={String(prefs.max_sessions_per_day)} onValueChange={v => update('max_sessions_per_day', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 8, 10, 12].map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">{t('staff.teacher.calendar.public_booking', { defaultValue: 'Public Booking' })}</Label>
              <p className="text-xs text-muted-foreground">{t('staff.teacher.calendar.public_booking_desc', { defaultValue: 'Allow students to book slots on your public page' })}</p>
            </div>
            <Switch checked={prefs.public_booking_enabled} onCheckedChange={v => update('public_booking_enabled', v)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════
// Month Calendar View
// ══════════════════════════════════════
function MonthCalendarView({ sessions, currentDate, timezone, onSelectSession, t }: {
  sessions: CalendarSessionItem[];
  currentDate: Date;
  timezone: string;
  onSelectSession: (id: string) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = startOfWeek(firstDay);
  const weeks: Date[][] = [];
  let cursor = new Date(startDate);
  while (cursor <= lastDay || weeks.length < 5) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cursor)); cursor = addDays(cursor, 1); }
    weeks.push(week);
    if (weeks.length >= 6) break;
  }

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, CalendarSessionItem[]>();
    for (const s of sessions) {
      const d = new Date(s.scheduled_at);
      const key = getDateKeyInTimeZone(d, timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions, timezone]);

  const weekDayNames = useMemo(() => {
    const ws = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => formatWeekdayShortInTimeZone(addDays(ws, i), timezone));
  }, [timezone]);

  const STATUS_COLORS_MONTH: Record<string, string> = {
    draft: 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]',
    scheduled: 'bg-[#039BE5]/10 text-[#039BE5] border-[#039BE5]/30',
    live: 'bg-[#EA4335]/10 text-[#EA4335] border-[#EA4335]/30',
    completed: 'bg-[#33B679]/10 text-[#188038] border-[#33B679]/30',
    cancelled: 'bg-[#F1F3F4]/50 text-[#80868B] border-[#DADCE0]/50',
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {weekDayNames.map((wd, i) => (
          <div key={i} className="p-2 text-center text-[11px] text-muted-foreground uppercase font-medium border-e border-border last:border-e-0">{wd}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0" style={{ minHeight: 100 }}>
          {week.map((day, di) => {
            const isCurrentMonth = day.getMonth() === month;
            const isToday = isTodayInTimeZone(day, timezone);
            const key = getDateKeyInTimeZone(day, timezone);
            const daySessions = sessionsByDay.get(key) || [];
            return (
              <div key={di} className={`border-e border-border last:border-e-0 p-1 ${isCurrentMonth ? '' : 'bg-muted/30'}`}>
                <div className={`text-xs mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto font-bold' : isCurrentMonth ? 'text-foreground text-center' : 'text-muted-foreground/50 text-center'}`}>{formatDayInTimeZone(day, timezone)}</div>
                <div className="space-y-0.5">
                  {daySessions.slice(0, 3).map(s => {
                    const colorClass = STATUS_COLORS_MONTH[s.status] || STATUS_COLORS_MONTH.draft;
                    const time = formatTimeInTimeZone(new Date(s.scheduled_at), timezone);
                    return (
                      <button key={s.id} className={`w-full text-start rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border ${colorClass}`} onClick={() => onSelectSession(s.id)}>
                        {time}
                      </button>
                    );
                  })}
                  {daySessions.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{daySessions.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
