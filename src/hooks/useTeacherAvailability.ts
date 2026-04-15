/**
 * useTeacherAvailability — Hook for the rule-based availability system.
 * Manages rules, exceptions, preferences, and conflict detection.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvailabilityRule {
  id?: string;
  user_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AvailabilityException {
  id?: string;
  user_id?: string;
  exception_date: string;
  start_time: string | null;
  end_time: string | null;
  exception_type: 'blackout' | 'override_available' | 'override_unavailable';
  reason?: string;
}

export interface AvailabilityPreferences {
  timezone: string;
  default_session_duration: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  public_booking_enabled: boolean;
  session_duration_presets: number[];
  max_sessions_per_day: number;
}

export interface BookedSession {
  id: string;
  scheduled_at: string;
  status: string;
  session_type: string;
  students: Array<{ student_user_id: string; full_name?: string | null }>;
  zoom_link?: string | null;
  lesson_slug?: string | null;
  module_slug?: string | null;
}

export interface ConflictInfo {
  session: BookedSession;
  overlapStart: string;
  overlapEnd: string;
}

export interface GeneratedSlot {
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isBlocked: boolean;
  session?: BookedSession;
}

const DEFAULT_PREFS: AvailabilityPreferences = {
  timezone: 'Asia/Dubai',
  default_session_duration: 50,
  buffer_before_minutes: 5,
  buffer_after_minutes: 10,
  public_booking_enabled: true,
  session_duration_presets: [30, 45, 50, 60, 90],
  max_sessions_per_day: 8,
};

export function useTeacherAvailability(teacherUserId?: string) {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [preferences, setPreferences] = useState<AvailabilityPreferences>(DEFAULT_PREFS);
  const [bookedSessions, setBookedSessions] = useState<BookedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const userId = teacherUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const [rulesRes, exceptionsRes, prefsRes, sessionsRes] = await Promise.all([
        (supabase as any).from('teacher_availability_rules').select('*').eq('user_id', userId).eq('is_active', true).order('day_of_week').order('start_time'),
        (supabase as any).from('teacher_availability_exceptions').select('*').eq('user_id', userId).order('exception_date'),
        (supabase as any).from('teacher_availability_preferences').select('*').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('teacher_sessions').select('id, scheduled_at, status, session_type, zoom_link, lesson_slug, module_slug').eq('teacher_user_id', userId).not('scheduled_at', 'is', null).in('status', ['draft', 'scheduled', 'live']).order('scheduled_at'),
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (exceptionsRes.data) setExceptions(exceptionsRes.data);
      if (prefsRes.data) {
        setPreferences({
          timezone: prefsRes.data.timezone || DEFAULT_PREFS.timezone,
          default_session_duration: prefsRes.data.default_session_duration ?? DEFAULT_PREFS.default_session_duration,
          buffer_before_minutes: prefsRes.data.buffer_before_minutes ?? DEFAULT_PREFS.buffer_before_minutes,
          buffer_after_minutes: prefsRes.data.buffer_after_minutes ?? DEFAULT_PREFS.buffer_after_minutes,
          public_booking_enabled: prefsRes.data.public_booking_enabled ?? DEFAULT_PREFS.public_booking_enabled,
          session_duration_presets: prefsRes.data.session_duration_presets ?? DEFAULT_PREFS.session_duration_presets,
          max_sessions_per_day: prefsRes.data.max_sessions_per_day ?? DEFAULT_PREFS.max_sessions_per_day,
        });
      }

      if (sessionsRes.data?.length) {
        const sessionIds = sessionsRes.data.map((s: any) => s.id);
        // teacher_session_students has no full_name — join profiles
        const { data: studentRows } = await (supabase as any)
          .from('teacher_session_students')
          .select('session_id, student_user_id')
          .in('session_id', sessionIds);

        // Fetch student names from profiles
        const studentUserIds = [...new Set((studentRows || []).map((r: any) => r.student_user_id))] as string[];
        const nameMap = new Map<string, string>();
        if (studentUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', studentUserIds);
          for (const p of (profiles || [])) {
            if (p.full_name) nameMap.set(p.user_id, p.full_name);
          }
        }

        const studentMap = new Map<string, Array<{ student_user_id: string; full_name?: string | null }>>();
        for (const row of (studentRows || [])) {
          if (!studentMap.has(row.session_id)) studentMap.set(row.session_id, []);
          studentMap.get(row.session_id)!.push({ student_user_id: row.student_user_id, full_name: nameMap.get(row.student_user_id) || null });
        }

        setBookedSessions(sessionsRes.data.map((s: any) => ({
          ...s,
          students: studentMap.get(s.id) || [],
        })));
      } else {
        setBookedSessions([]);
      }
    } catch (err) {
      console.error('[useTeacherAvailability] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [teacherUserId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveRules = useCallback(async (newRules: AvailabilityRule[]) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await (supabase as any).from('teacher_availability_rules').delete().eq('user_id', user.id);
      if (newRules.length > 0) {
        const rows = newRules.map(r => ({
          user_id: user.id,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          is_active: true,
        }));
        await (supabase as any).from('teacher_availability_rules').insert(rows);
      }
      setRules(newRules);
    } finally {
      setSaving(false);
    }
  }, []);

  const savePreferences = useCallback(async (newPrefs: AvailabilityPreferences) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await (supabase as any).from('teacher_availability_preferences').upsert({
        user_id: user.id,
        ...newPrefs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      await (supabase as any).from('teacher_public_profiles').upsert(
        { user_id: user.id, timezone: newPrefs.timezone, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      setPreferences(newPrefs);
    } finally {
      setSaving(false);
    }
  }, []);

  const addException = useCallback(async (exception: Omit<AvailabilityException, 'id' | 'user_id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[addException] No authenticated user');
      throw new Error('Not authenticated');
    }

    const normalized = {
      exception_date: exception.exception_date,
      exception_type: exception.exception_type,
      start_time: exception.start_time ?? null,
      end_time: exception.end_time ?? null,
      reason: exception.reason ?? null,
    };

    let existsQuery = (supabase as any)
      .from('teacher_availability_exceptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('exception_date', normalized.exception_date)
      .eq('exception_type', normalized.exception_type)
      .limit(1);

    existsQuery = normalized.start_time === null
      ? existsQuery.is('start_time', null)
      : existsQuery.eq('start_time', normalized.start_time);

    existsQuery = normalized.end_time === null
      ? existsQuery.is('end_time', null)
      : existsQuery.eq('end_time', normalized.end_time);

    const { data: existing, error: existingError } = await existsQuery.maybeSingle();
    if (existingError) {
      console.error('[addException] Existing-check error:', existingError);
      throw existingError;
    }

    if (existing?.id) {
      console.log('[addException] Duplicate skipped:', normalized);
      return;
    }

    console.log('[addException] Inserting:', { user_id: user.id, ...normalized });
    const { data, error } = await (supabase as any)
      .from('teacher_availability_exceptions')
      .insert({ user_id: user.id, ...normalized })
      .select()
      .single();

    if (error) {
      console.error('[addException] DB error:', error);
      throw error;
    }

    if (data) setExceptions(prev => [...prev, data]);
  }, []);

  const removeException = useCallback(async (exceptionId: string) => {
    await (supabase as any).from('teacher_availability_exceptions').delete().eq('id', exceptionId);
    setExceptions(prev => prev.filter(e => e.id !== exceptionId));
  }, []);

  const removeExceptionsByDate = useCallback(async (dates: string[], exceptionType?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    for (const date of dates) {
      let query = (supabase as any)
        .from('teacher_availability_exceptions')
        .delete()
        .eq('user_id', user.id)
        .eq('exception_date', date);

      if (exceptionType) {
        query = query.eq('exception_type', exceptionType);
      }

      const { error } = await query;
      if (error) {
        console.error('[removeExceptionsByDate] Error for date', date, error);
        throw error;
      }
    }

    setExceptions(prev => prev.filter(e => {
      if (!dates.includes(e.exception_date)) return true;
      if (exceptionType && e.exception_type !== exceptionType) return true;
      return false;
    }));
  }, []);

  const detectConflicts = useCallback((date: string, startTime: string, endTime: string): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = [];
    const tz = preferences.timezone || DEFAULT_PREFS.timezone;

    for (const session of bookedSessions) {
      if (!session.scheduled_at) continue;
      const dt = new Date(session.scheduled_at);
      const sessionDate = getDateKeyInTimeZone(dt, tz);
      if (sessionDate !== date) continue;

      const sessionStart = getTimeKeyInTimeZone(dt, tz);
      const startMin = getMinutesInTimeZone(dt, tz);
      const endMin = startMin + (preferences.default_session_duration || 50);
      const sessionEnd = minutesToTime(endMin);

      if (sessionStart < endTime && sessionEnd > startTime) {
        conflicts.push({ session, overlapStart: sessionStart, overlapEnd: sessionEnd });
      }
    }

    return conflicts;
  }, [bookedSessions, preferences.default_session_duration, preferences.timezone]);

  const generateSlots = useCallback((startDate: Date, endDate: Date): GeneratedSlot[] => {
    const slots: GeneratedSlot[] = [];
    const cursor = new Date(startDate);
    const tz = preferences.timezone || DEFAULT_PREFS.timezone;

    while (cursor <= endDate) {
      const dayOfWeek = getDayOfWeekInTimeZone(cursor, tz);
      const dateStr = getDateKeyInTimeZone(cursor, tz);

      const dateExceptions = exceptions.filter(e => e.exception_date === dateStr);
      const isBlackedOut = dateExceptions.some(e => e.exception_type === 'blackout' && !e.start_time);

      if (!isBlackedOut) {
        const dayRules = rules.filter(r => r.day_of_week === dayOfWeek && r.is_active);
        const partialBlackouts = dateExceptions.filter(e => e.exception_type === 'blackout' && e.start_time);
        const overrideAvailable = dateExceptions.filter(e => e.exception_type === 'override_available');

        for (const rule of dayRules) {
          let startMin = timeToMinutes(rule.start_time);
          const endMin = timeToMinutes(rule.end_time);
          const slotDuration = preferences.default_session_duration;
          const totalBuffer = preferences.buffer_before_minutes + preferences.buffer_after_minutes;

          while (startMin + slotDuration <= endMin) {
            const slotStart = minutesToTime(startMin);
            const slotEnd = minutesToTime(startMin + slotDuration);

            const blocked = partialBlackouts.some(b =>
              b.start_time && b.end_time && slotStart >= b.start_time && slotEnd <= b.end_time
            );

            const sessionAtSlot = bookedSessions.find(s => {
              if (!s.scheduled_at) return false;
              const dt = new Date(s.scheduled_at);
              const sDate = getDateKeyInTimeZone(dt, tz);
              if (sDate !== dateStr) return false;
              const sTime = getTimeKeyInTimeZone(dt, tz);
              return sTime >= slotStart && sTime < slotEnd;
            });

            slots.push({
              date: dateStr,
              dayOfWeek,
              startTime: slotStart,
              endTime: slotEnd,
              isBooked: !!sessionAtSlot,
              isBlocked: blocked,
              session: sessionAtSlot,
            });

            startMin += slotDuration + totalBuffer;
          }
        }

        for (const override of overrideAvailable) {
          if (override.start_time && override.end_time) {
            slots.push({
              date: dateStr,
              dayOfWeek,
              startTime: override.start_time,
              endTime: override.end_time,
              isBooked: false,
              isBlocked: false,
            });
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return slots;
  }, [rules, exceptions, bookedSessions, preferences]);

  const reminders = useMemo(() => {
    const alerts: Array<{ type: string; messageKey: string; data?: Record<string, any> }> = [];
    const now = new Date();
    const tz = preferences.timezone || DEFAULT_PREFS.timezone;
    const todayStr = getDateKeyInTimeZone(now, tz);

    const todaySessions = bookedSessions.filter(s => {
      if (!s.scheduled_at) return false;
      return getDateKeyInTimeZone(new Date(s.scheduled_at), tz) === todayStr;
    });

    if (todaySessions.length > 0) {
      alerts.push({ type: 'info', messageKey: 'staff.teacher.calendar.reminder_sessions_today', data: { count: todaySessions.length } });
    }

    for (const s of todaySessions) {
      const diff = new Date(s.scheduled_at).getTime() - now.getTime();
      if (diff > 0 && diff <= 30 * 60 * 1000) {
        const studentNames = s.students.map(st => st.full_name || st.student_user_id).join(', ');
        alerts.push({ type: 'urgent', messageKey: 'staff.teacher.calendar.reminder_upcoming_30min', data: { students: studentNames } });
      }
    }

    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekSlots = generateSlots(now, weekEnd);
    const freeSlots = weekSlots.filter(s => !s.isBooked && !s.isBlocked);
    if (freeSlots.length === 0) {
      alerts.push({ type: 'warning', messageKey: 'staff.teacher.calendar.reminder_no_availability' });
    }

    if (!preferences.public_booking_enabled) {
      alerts.push({ type: 'warning', messageKey: 'staff.teacher.calendar.reminder_booking_disabled' });
    }

    return alerts;
  }, [bookedSessions, preferences, generateSlots]);

  return {
    rules, exceptions, preferences, bookedSessions, loading, saving,
    saveRules, savePreferences, addException, removeException, removeExceptionsByDate,
    detectConflicts, generateSlots, reminders,
    refresh: loadAll,
  };
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

function getMinutesInTimeZone(date: Date, timeZone: string): number {
  const [h, m] = getTimeKeyInTimeZone(date, timeZone).split(':').map(Number);
  return h * 60 + (m || 0);
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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
