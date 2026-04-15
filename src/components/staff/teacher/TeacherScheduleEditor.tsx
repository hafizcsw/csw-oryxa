/**
 * TeacherScheduleEditor — Weekly availability grid editor for teacher dashboard.
 * On readOnly (public view): shows availability + booked sessions with timezone-aware mapping.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Plus, X, Loader2, Pencil, Save, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimeSlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface SessionRow {
  scheduled_at: string;
  status: string;
}

interface BookedSlot {
  date: string; // YYYY-MM-DD in selected timezone
  start_time: string;
  end_time: string;
}

const DAY_KEYS = [
  'common.days.sunday', 'common.days.monday', 'common.days.tuesday',
  'common.days.wednesday', 'common.days.thursday', 'common.days.friday', 'common.days.saturday'
];

const DAY_DEFAULTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]
).flat();

const TIMEZONES = [
  'Asia/Dubai', 'Asia/Riyadh', 'Europe/Moscow', 'Europe/London',
  'America/New_York', 'Asia/Tashkent', 'Europe/Istanbul', 'Africa/Cairo',
  'Asia/Kolkata', 'Asia/Shanghai', 'Europe/Berlin', 'Europe/Paris'
];

interface Props {
  readOnly?: boolean;
  teacherUserId?: string;
}
interface AvailabilityException {
  exception_date: string;
  start_time: string | null;
  end_time: string | null;
  exception_type: 'blackout' | 'override_available' | 'override_unavailable';
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const normalized = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

function getTimeKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
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

function mergeSlotsToRules(slots: TimeSlot[]): TimeSlot[] {
  const merged: TimeSlot[] = [];

  for (let day = 0; day < 7; day++) {
    const daySlots = slots
      .filter(s => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (!daySlots.length) continue;

    let currentStart = daySlots[0].start_time;
    let currentEnd = daySlots[0].end_time;

    for (let i = 1; i < daySlots.length; i++) {
      const next = daySlots[i];
      if (next.start_time === currentEnd) {
        currentEnd = next.end_time;
      } else {
        merged.push({ day_of_week: day, start_time: currentStart, end_time: currentEnd, is_active: true });
        currentStart = next.start_time;
        currentEnd = next.end_time;
      }
    }

    merged.push({ day_of_week: day, start_time: currentStart, end_time: currentEnd, is_active: true });
  }

  return merged;
}

export function TeacherScheduleEditor({ readOnly = false, teacherUserId }: Props) {
  const { t, language } = useLanguage();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [weekOffset, setWeekOffset] = useState(0);
  const [defaultSessionDuration, setDefaultSessionDuration] = useState(50);
  const [displayDuration, setDisplayDuration] = useState(50);
  const [publicBookingEnabled, setPublicBookingEnabled] = useState(true);
  const [authReady, setAuthReady] = useState(readOnly || !!teacherUserId);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(0);

  // Auth readiness for internal teacher view to avoid loading before session restore
  useEffect(() => {
    if (readOnly || teacherUserId) return;

    let active = true;
    supabase.auth.getSession().then(() => {
      if (active) setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (active) {
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [readOnly, teacherUserId]);

  const weekDates = useMemo(() => {
    const now = new Date();
    const ws = startOfWeek(now);
    ws.setDate(ws.getDate() + weekOffset * 7);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [weekOffset]);

  const weekRangeLabel = useMemo(
    () => `${weekDates[0].toLocaleDateString(language, { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    [weekDates, language]
  );

  const loadSlots = useCallback(async () => {
    if (!authReady && !teacherUserId) return;

    setLoading(true);
    try {
      const userId = teacherUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      // Load canonical availability rules
      const { data: rulesData } = await (supabase as any)
        .from('teacher_availability_rules')
        .select('day_of_week, start_time, end_time, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');

      if (rulesData?.length) {
        // Expand rules to 30-min slots for this compact schedule UI
        const expanded: TimeSlot[] = [];
        for (const rule of rulesData) {
          let cur = timeToMinutes(rule.start_time);
          const end = timeToMinutes(rule.end_time);
          while (cur + 30 <= end) {
            expanded.push({
              day_of_week: rule.day_of_week,
              start_time: minutesToTime(cur),
              end_time: minutesToTime(cur + 30),
              is_active: true,
            });
            cur += 30;
          }
        }
        setSlots(expanded.sort((a, b) => (a.day_of_week - b.day_of_week) || a.start_time.localeCompare(b.start_time)));
      } else {
        setSlots([]);
      }
      const { data: exceptionRows } = await (supabase as any)
        .from('teacher_availability_exceptions')
        .select('exception_date, start_time, end_time, exception_type')
        .eq('user_id', userId)
        .order('exception_date');
      setExceptions(exceptionRows || []);

      // Load preferences
      const { data: prefs } = await (supabase as any)
        .from('teacher_availability_preferences')
        .select('timezone, default_session_duration, public_booking_enabled, buffer_before_minutes, buffer_after_minutes')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs?.timezone) setTimezone(prefs.timezone);
      if (prefs?.default_session_duration) {
        setDefaultSessionDuration(prefs.default_session_duration);
        setDisplayDuration(prefs.default_session_duration);
      }
      if (typeof prefs?.public_booking_enabled === 'boolean') {
        setPublicBookingEnabled(prefs.public_booking_enabled);
      }
      setBufferBeforeMinutes(Number(prefs?.buffer_before_minutes || 0));
      setBufferAfterMinutes(Number(prefs?.buffer_after_minutes || 0));

      // Load sessions in wider range to avoid timezone edge misses
      const start = new Date(weekDates[0]);
      start.setDate(start.getDate() - 2);
      start.setHours(0, 0, 0, 0);

      const end = new Date(weekDates[6]);
      end.setDate(end.getDate() + 2);
      end.setHours(23, 59, 59, 999);

      const { data: sessions } = await (supabase as any)
        .from('teacher_sessions')
        .select('scheduled_at, status')
        .eq('teacher_user_id', userId)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
        .in('status', ['draft', 'scheduled', 'live']);

      setSessionRows(sessions || []);
    } catch (err) {
      console.error('[TeacherScheduleEditor] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId, weekDates, authReady]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const bookedSlots = useMemo<BookedSlot[]>(() => {
    return sessionRows.map((s) => {
      const dt = new Date(s.scheduled_at);
      const dateStr = getDateKeyInTimeZone(dt, timezone);
      const startTime = getTimeKeyInTimeZone(dt, timezone);
      const endMinutes = timeToMinutes(startTime) + defaultSessionDuration;
      const endTime = minutesToTime(endMinutes);
      return { date: dateStr, start_time: startTime, end_time: endTime };
    });
  }, [sessionRows, timezone, defaultSessionDuration]);

  const addSlot = (dayOfWeek: number, startTime: string) => {
    const endMinutes = timeToMinutes(startTime) + 30;
    const endTime = minutesToTime(endMinutes);

    const exists = slots.some(s => s.day_of_week === dayOfWeek && s.start_time === startTime);
    if (exists) return;

    setSlots(prev => [...prev, { day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, is_active: true }]);
  };

  const removeSlot = (dayOfWeek: number, startTime: string) => {
    setSlots(prev => prev.filter(s => !(s.day_of_week === dayOfWeek && s.start_time === startTime)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Canonical rules from merged contiguous 30-min slots
      const mergedRules = mergeSlotsToRules(slots);

      await (supabase as any).from('teacher_availability_rules').delete().eq('user_id', user.id);
      if (mergedRules.length > 0) {
        const ruleRows = mergedRules.map(r => ({
          user_id: user.id,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: true,
        }));
        const { error: rulesError } = await (supabase as any).from('teacher_availability_rules').insert(ruleRows);
        if (rulesError) throw rulesError;
      }

      await (supabase as any).from('teacher_availability_preferences').upsert(
        { user_id: user.id, timezone, default_session_duration: displayDuration, public_booking_enabled: publicBookingEnabled, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      await (supabase as any).from('teacher_public_profiles').upsert(
        { user_id: user.id, timezone, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      setDefaultSessionDuration(displayDuration);
      toast.success(t('staff.teacher.schedule.saved', { defaultValue: 'Schedule saved' }));
      setEditing(false);
      loadSlots();
    } catch (err: any) {
      console.error('[TeacherScheduleEditor] Save error:', err);
      toast.error(err?.message || t('common.error', { defaultValue: 'Error' }));
    } finally {
      setSaving(false);
    }
  };

  const getSlotsForDate = (date: Date) => {
    const day = getDayOfWeekInTimeZone(date, timezone);
    return slots.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const getBookedForDate = (date: Date) => {
    const dateStr = getDateKeyInTimeZone(date, timezone);
    return bookedSlots.filter(b => b.date === dateStr);
  };

  const isSlotBooked = (date: Date, slotTime: string) => {
    const booked = getBookedForDate(date);
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + displayDuration;

    return booked.some(b => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return bStart < slotEnd && bEnd > slotStart;
    });
  };
  const isSlotBlockedByException = (date: Date, slotTime: string) => {
    const dateStr = getDateKeyInTimeZone(date, timezone);
    const dayExceptions = exceptions.filter((e) => e.exception_date === dateStr);
    if (!dayExceptions.length) return false;

    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + displayDuration;

    const fullBlackout = dayExceptions.some((e) => e.exception_type === 'blackout' && !e.start_time);
    if (fullBlackout) return true;

    const explicitUnavailable = dayExceptions.some((e) => {
      if (e.exception_type !== 'blackout' && e.exception_type !== 'override_unavailable') return false;
      if (!e.start_time || !e.end_time) return false;
      const exStart = timeToMinutes(e.start_time);
      const exEnd = timeToMinutes(e.end_time);
      return exStart < slotEnd && exEnd > slotStart;
    });
    if (explicitUnavailable) return true;

    const hasOverrideAvailable = dayExceptions.some((e) => e.exception_type === 'override_available');
    if (!hasOverrideAvailable) return false;
    return !dayExceptions.some((e) => {
      if (e.exception_type !== 'override_available' || !e.start_time || !e.end_time) return false;
      const exStart = timeToMinutes(e.start_time);
      const exEnd = timeToMinutes(e.end_time);
      return exStart <= slotStart && exEnd >= slotEnd;
    });
  };
  const isSlotBlockedByBuffer = (date: Date, slotTime: string) => {
    const booked = getBookedForDate(date);
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + displayDuration;
    return booked.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      const blockedStart = bStart - bufferBeforeMinutes;
      const blockedEnd = bEnd + bufferAfterMinutes;
      return blockedStart < slotEnd && blockedEnd > slotStart;
    });
  };
  const isSlotPubliclyAvailable = (date: Date, slotTime: string) => {
    if (!publicBookingEnabled) return false;
    if (isSlotBooked(date, slotTime)) return false;
    if (isSlotBlockedByException(date, slotTime)) return false;
    if (isSlotBlockedByBuffer(date, slotTime)) return false;
    return true;
  };

  if (loading || (!authReady && !teacherUserId)) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center min-h-[180px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            {t('staff.teacher.schedule.title', { defaultValue: 'Schedule' })}
          </h4>

          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
              className="gap-1.5"
            >
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : editing
                  ? <Save className="h-3.5 w-3.5" />
                  : <Pencil className="h-3.5 w-3.5" />}
              {editing
                ? t('staff.teacher.schedule.save', { defaultValue: 'Save' })
                : t('staff.teacher.schedule.edit', { defaultValue: 'Edit' })}
            </Button>
          )}
        </div>

        {/* Info banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-foreground">
          <span className="inline-block me-1">ℹ️</span>
          {t('staff.teacher.schedule.hint', { defaultValue: 'Choose the time for your first lesson. Times will appear based on your timezone.' })}
        </div>

        {/* Duration + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {[25, 50].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={displayDuration === d ? 'default' : 'outline'}
              onClick={() => setDisplayDuration(d)}
              disabled={!editing && !readOnly}
              className="h-8 min-w-[120px]"
            >
              {d} {t('staff.teacher.profile.minutes', { defaultValue: 'min' })}
            </Button>
          ))}

          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[180px] text-center">{weekRangeLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={timezone} onValueChange={setTimezone} disabled={!editing && !readOnly}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Availability table — all 7 days in one row */}
        <div className="grid [grid-template-columns:repeat(7,minmax(0,1fr))] divide-x divide-border border border-border rounded-lg overflow-hidden">
          {weekDates.map((date, i) => {
            const daySlots = getSlotsForDate(date);
            const dayBooked = getBookedForDate(date);
            const isToday = getDateKeyInTimeZone(new Date(), timezone) === getDateKeyInTimeZone(date, timezone);

            return (
              <div key={i} className="flex flex-col min-w-0 overflow-hidden">
                {/* Day header with colored top border */}
                <div className={`border-t-[3px] ${isToday ? 'border-t-primary' : 'border-t-primary/30'} px-1 py-2 text-center bg-muted/30`}>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {t(DAY_KEYS[getDayOfWeekInTimeZone(date, timezone)], { defaultValue: DAY_DEFAULTS[getDayOfWeekInTimeZone(date, timezone)] })}
                  </p>
                  <p className={`text-sm sm:text-lg font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {new Intl.DateTimeFormat(language || undefined, { timeZone: timezone, day: 'numeric' }).format(date)}
                  </p>
                </div>

                {/* Time slots */}
                <div className="flex-1 px-1 py-2 space-y-0.5 min-h-[200px]">
                  {daySlots.map((slot) => {
                    const booked = isSlotBooked(date, slot.start_time);
                    const publicUnavailable = readOnly && !isSlotPubliclyAvailable(date, slot.start_time);
                    return (
                      <div key={`${slot.day_of_week}-${slot.start_time}`} className="relative group">
                        <button
                          type="button"
                          className={`w-full py-1 text-center text-sm font-semibold underline decoration-1 underline-offset-2 transition-colors ${
                            booked || publicUnavailable
                              ? 'text-destructive line-through decoration-destructive/50'
                              : 'text-foreground hover:text-primary'
                          }`}
                        >
                          {slot.start_time.slice(0, 5)}
                          {booked && (
                            <span className="ms-0.5 text-[9px] no-underline font-normal">
                              ✕
                            </span>
                          )}
                        </button>

                        {editing && !readOnly && (
                          <button
                            onClick={() => removeSlot(slot.day_of_week, slot.start_time)}
                            className="absolute -top-1 -end-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* booked sessions not matching an availability slot */}
                  {dayBooked
                    .filter(b => !daySlots.some(s => s.start_time === b.start_time))
                    .map((b, idx) => (
                      <div key={`booked-extra-${idx}`} className="w-full py-1 text-center text-sm font-semibold text-destructive line-through underline">
                        {b.start_time.slice(0, 5)}
                        <span className="ms-0.5 text-[9px] no-underline font-normal">✕</span>
                      </div>
                    ))}

                  {editing && !readOnly && (
                    <Select onValueChange={(time) => addSlot(getDayOfWeekInTimeZone(date, timezone), time)}>
                      <SelectTrigger className="h-6 text-xs mt-1">
                        <Plus className="h-3 w-3" />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {HOUR_OPTIONS
                          .filter(ti => !daySlots.some(s => s.start_time === ti))
                          .map(time => (
                            <SelectItem key={time} value={time} className="text-xs">{time}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}

                  {daySlots.length === 0 && dayBooked.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-6">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary/10 border border-primary/20" />
            {t('staff.teacher.schedule.available', { defaultValue: 'Available' })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-destructive/10 border border-destructive/30" />
            {t('staff.teacher.schedule.booked', { defaultValue: 'Booked' })}
          </span>
          {readOnly && !publicBookingEnabled && (
            <Badge variant="outline" className="text-[10px]">
              {t('staff.teacher.schedule.publicBookingDisabled', { defaultValue: 'Public booking currently disabled' })}
            </Badge>
          )}
        </div>

        {!readOnly && !editing && (
          <div className="text-center pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="text-xs">
              {t('staff.teacher.schedule.viewFull', { defaultValue: 'View full schedule' })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
