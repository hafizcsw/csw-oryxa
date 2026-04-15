/**
 * TeacherSessionCreate — Zoom-inspired session scheduling with inline student picker,
 * professional time/duration/timezone controls, curriculum target, and Zoom link.
 */
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createSession, updateSession } from '@/hooks/useTeacherSessions';
import { useTeacherStudents } from '@/hooks/useTeacherStudents';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Users, Video, Calendar, BookOpen, Target, X, Search,
  Clock, Globe, ChevronLeft, GraduationCap, Sparkles, Repeat, CalendarDays
} from 'lucide-react';
import type { TeacherStudent } from '@/hooks/useTeacherStudents';
import { TeacherCurriculumSelector } from '@/components/staff/teacher/TeacherCurriculumSelector';
import { getRussianCurriculumModules } from '@/lib/teacherCurriculum';

interface Props {
  selectedStudents: TeacherStudent[];
  onCreated: (sessionId: string) => void;
  onCancel: () => void;
}

const SESSION_TYPES = [
  'lesson_delivery', 'review', 'reinforcement', 'checkpoint_prep',
] as const;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const DURATIONS = [
  { value: '25', label: '25' },
  { value: '40', label: '40' },
  { value: '50', label: '50' },
  { value: '60', label: '60' },
  { value: '90', label: '90' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', labelKey: 'staff.teacher.session.recurrence_none', defaultLabel: 'No repeat' },
  { value: 'daily_week', labelKey: 'staff.teacher.session.recurrence_daily_week', defaultLabel: 'Every day for 1 week' },
  { value: 'daily_2weeks', labelKey: 'staff.teacher.session.recurrence_daily_2weeks', defaultLabel: 'Every day for 2 weeks' },
  { value: 'daily_month', labelKey: 'staff.teacher.session.recurrence_daily_month', defaultLabel: 'Every day for 1 month' },
  { value: 'custom_days', labelKey: 'staff.teacher.session.recurrence_custom', defaultLabel: 'Custom days of week' },
] as const;

const WEEKDAYS = [
  { value: 0, labelKey: 'staff.teacher.session.day_sun', defaultLabel: 'Sun' },
  { value: 1, labelKey: 'staff.teacher.session.day_mon', defaultLabel: 'Mon' },
  { value: 2, labelKey: 'staff.teacher.session.day_tue', defaultLabel: 'Tue' },
  { value: 3, labelKey: 'staff.teacher.session.day_wed', defaultLabel: 'Wed' },
  { value: 4, labelKey: 'staff.teacher.session.day_thu', defaultLabel: 'Thu' },
  { value: 5, labelKey: 'staff.teacher.session.day_fri', defaultLabel: 'Fri' },
  { value: 6, labelKey: 'staff.teacher.session.day_sat', defaultLabel: 'Sat' },
];

const TIMEZONES = [
  { value: 'Europe/Moscow', label: '(GMT+3:00) Moscow' },
  { value: 'Asia/Dubai', label: '(GMT+4:00) Dubai' },
  { value: 'Asia/Riyadh', label: '(GMT+3:00) Riyadh' },
  { value: 'Europe/Istanbul', label: '(GMT+3:00) Istanbul' },
  { value: 'Europe/London', label: '(GMT+0:00) London' },
  { value: 'America/New_York', label: '(GMT-5:00) New York' },
  { value: 'Asia/Kolkata', label: '(GMT+5:30) India' },
  { value: 'Asia/Shanghai', label: '(GMT+8:00) Shanghai' },
  { value: 'Asia/Tokyo', label: '(GMT+9:00) Tokyo' },
  { value: 'Europe/Berlin', label: '(GMT+1:00) Berlin' },
  { value: 'Africa/Cairo', label: '(GMT+2:00) Cairo' },
];

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Europe/Moscow';
  }
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function TeacherSessionCreate({ selectedStudents: initialSelected, onCreated, onCancel }: Props) {
  const { t } = useLanguage();
  const { students: allStudents } = useTeacherStudents();

  // Students
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelected.map(s => s.user_id))
  );
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentPicker, setShowStudentPicker] = useState(initialSelected.length === 0);

  // Session config
  const [sessionType, setSessionType] = useState<string>('lesson_delivery');
  const [teacherType, setTeacherType] = useState<'language_teacher' | 'curriculum_exam_teacher'>(() => {
    const raw = localStorage.getItem('teacher_ops_settings_v1');
    if (!raw) return 'language_teacher';
    try {
      const parsed = JSON.parse(raw);
      return parsed.teacherType === 'curriculum_exam_teacher' ? 'curriculum_exam_teacher' : 'language_teacher';
    } catch {
      return 'language_teacher';
    }
  });
  const [moduleSlug, setModuleSlug] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');

  // Schedule — Zoom-style
  const [scheduledDate, setScheduledDate] = useState(todayISO());
  const [hour, setHour] = useState('11');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [duration, setDuration] = useState('40');
  const [timezone, setTimezone] = useState(guessTimezone());

  const [zoomLink, setZoomLink] = useState('');
  const [recurrence, setRecurrence] = useState<string>('none');
  const [customDays, setCustomDays] = useState<Set<number>>(new Set());
  const [customWeeks, setCustomWeeks] = useState<number>(4);
  const [submitting, setSubmitting] = useState(false);

  const selectedStudents = useMemo(
    () => allStudents.filter(s => selectedIds.has(s.user_id)),
    [allStudents, selectedIds]
  );
  const curriculumModules = useMemo(() => getRussianCurriculumModules(), []);
  const moduleTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const module of curriculumModules) {
      map.set(module.slug, t(module.titleKey));
    }
    return map;
  }, [curriculumModules, t]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return allStudents;
    const q = studentSearch.toLowerCase();
    return allStudents.filter(s =>
      (s.full_name?.toLowerCase().includes(q)) ||
      (s.email?.toLowerCase().includes(q)) ||
      (s.phone?.toLowerCase().includes(q))
    );
  }, [allStudents, studentSearch]);

  const toggleStudent = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const getStudentLabel = (s: TeacherStudent) => {
    if (s.full_name) return s.full_name;
    if (s.email?.includes('@portal.csw.local')) return `+${s.email.split('@')[0]}`;
    return s.email?.split('@')[0] || s.user_id.slice(0, 8);
  };

  const commonModule = (() => {
    const modules = selectedStudents.map(s => s.current_module).filter(Boolean);
    if (modules.length && modules.every(m => m === modules[0])) return modules[0];
    return null;
  })();

  const commonLesson = (() => {
    const lessons = selectedStudents.map(s => s.current_lesson).filter(Boolean);
    if (lessons.length && lessons.every(l => l === lessons[0])) return lessons[0];
    return null;
  })();

  const buildScheduledAt = (dateOverride?: string): string | null => {
    const d = dateOverride || scheduledDate;
    if (!d) return null;
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const timeStr = `${String(h).padStart(2, '0')}:${minute}:00`;
    return new Date(`${d}T${timeStr}`).toISOString();
  };

  /** Generate all dates based on recurrence settings */
  const getRecurrenceDates = (): string[] => {
    if (!scheduledDate) return [scheduledDate];
    if (recurrence === 'none') return [scheduledDate];

    const start = new Date(scheduledDate);
    const dates: string[] = [];

    if (recurrence === 'daily_week' || recurrence === 'daily_2weeks' || recurrence === 'daily_month') {
      const totalDays = recurrence === 'daily_week' ? 7 : recurrence === 'daily_2weeks' ? 14 : 30;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (recurrence === 'custom_days' && customDays.size > 0) {
      const totalDays = customWeeks * 7;
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if (customDays.has(d.getDay())) {
          dates.push(d.toISOString().split('T')[0]);
        }
      }
    }

    return dates.length > 0 ? dates : [scheduledDate];
  };

  const recurrenceDates = useMemo(() => getRecurrenceDates(), [scheduledDate, recurrence, customDays, customWeeks]);
  const totalSessions = recurrenceDates.length;

  const handleCreate = async () => {
    if (!selectedStudents.length) return;
    setSubmitting(true);
    try {
      const dates = recurrenceDates;
      let createdCount = 0;
      let failedCount = 0;
      let lastSessionId = '';

      for (const dateStr of dates) {
        const scheduledAt = buildScheduledAt(dateStr);
        const res = await createSession({
          student_user_ids: selectedStudents.map(s => s.user_id),
          session_type: sessionType,
          teacher_type: teacherType,
          module_slug: moduleSlug || commonModule || null,
          lesson_slug: lessonSlug || commonLesson || null,
          ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
        });
        if (res.ok && res.data) {
          createdCount++;
          lastSessionId = res.data.id;
          if (zoomLink) {
            await updateSession({
              session_id: res.data.id,
              zoom_link: zoomLink,
            });
          }
        } else {
          failedCount++;
          console.error('[TeacherSessionCreate] create failed for date:', dateStr, res.error);
        }
      }

      if (createdCount > 0) {
        toast({
          title: totalSessions > 1
            ? t('staff.teacher.session.batch_created', { defaultValue: '{{count}} sessions created', count: String(createdCount) })
            : t('staff.teacher.session.created', { defaultValue: 'Session created' }),
          ...(failedCount > 0 ? { description: `${failedCount} failed`, variant: 'destructive' as const } : {}),
        });
        onCreated(lastSessionId);
      } else {
        toast({ title: t('staff.teacher.session.create_error', { defaultValue: 'Failed to create session' }), variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const detectedTz = TIMEZONES.find(tz => tz.value === timezone);
  const tzLabel = detectedTz?.label || timezone;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">
            {t('staff.teacher.session.create_title', { defaultValue: 'Schedule Session' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('staff.teacher.session.create_subtitle', { defaultValue: 'Set up students, curriculum & schedule' })}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {/* ─── Row: Session Type ─── */}
        <FormRow
          icon={<Target className="h-4 w-4" />}
          label={t('staff.teacher.session.type_label', { defaultValue: 'Session Type' })}
        >
          <div className="flex gap-2 flex-wrap">
            {SESSION_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setSessionType(type)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  sessionType === type
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-foreground hover:bg-muted'
                }`}
              >
                {t(`staff.teacher.session.type_${type}`, { defaultValue: type.replace(/_/g, ' ') })}
              </button>
            ))}
          </div>
        </FormRow>

        <Separator />

        {/* ─── Row: Teacher Type ─── */}
        <FormRow
          icon={<GraduationCap className="h-4 w-4" />}
          label={t('staff.teacher.session.teacher_type', { defaultValue: 'Teacher Type' })}
        >
          <Select value={teacherType} onValueChange={(v) => setTeacherType(v as any)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="language_teacher">
                {t('staff.teacher.type.language_teacher', { defaultValue: 'Language Teacher' })}
              </SelectItem>
              <SelectItem value="curriculum_exam_teacher">
                {t('staff.teacher.type.curriculum_exam_teacher', { defaultValue: 'Curriculum/Exam Teacher' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormRow>

        <Separator />

        {/* ─── Row: Students ─── */}
        <FormRow
          icon={<Users className="h-4 w-4" />}
          label={t('staff.teacher.session.students_label', { defaultValue: 'Students' })}
          badge={selectedStudents.length > 0 ? String(selectedStudents.length) : undefined}
        >
          <div className="space-y-3">
            {/* Selected chips */}
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedStudents.map(s => (
                  <Badge key={s.user_id} variant="secondary" className="text-xs py-1 px-2 gap-1">
                    {getStudentLabel(s)}
                    <button type="button" onClick={() => toggleStudent(s.user_id)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Toggle picker */}
            {!showStudentPicker && (
              <Button variant="outline" size="sm" onClick={() => setShowStudentPicker(true)}>
                <Plus className="h-3.5 w-3.5 me-1" />
                {t('staff.teacher.session.add_students', { defaultValue: 'Add Students' })}
              </Button>
            )}

            {showStudentPicker && (
              <div className="border rounded-lg overflow-hidden">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder={t('staff.teacher.session.search_students', { defaultValue: 'Search students...' })}
                    className="ps-9 border-0 border-b rounded-none focus-visible:ring-0"
                  />
                </div>
                <ScrollArea className="max-h-44">
                  <div className="py-1">
                    {filteredStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('staff.teacher.session.no_students_found', { defaultValue: 'No students found' })}
                      </p>
                    ) : (
                      filteredStudents.map(s => (
                        <label
                          key={s.user_id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedIds.has(s.user_id)}
                            onCheckedChange={() => toggleStudent(s.user_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getStudentLabel(s)}</p>
                            {s.current_module && (
                              <p className="text-xs text-muted-foreground truncate">
                                {moduleTitleMap.get(s.current_module) || s.current_module}
                              </p>
                            )}
                          </div>
                          {selectedIds.has(s.user_id) && (
                            <span className="text-xs text-primary font-medium">✓</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Grouping hint */}
            {commonModule && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/10">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {t('staff.teacher.session.same_module', { defaultValue: 'All students are on module: {{module}}', module: commonModule })}
                  {commonLesson && ` · ${commonLesson}`}
                </p>
              </div>
            )}
          </div>
        </FormRow>

        <Separator />

        {/* ─── Row: Curriculum Target ─── */}
        <FormRow
          icon={<BookOpen className="h-4 w-4" />}
          label={t('staff.teacher.session.curriculum_target', { defaultValue: 'Curriculum Target' })}
        >
          <TeacherCurriculumSelector
            moduleSlug={moduleSlug || commonModule || ''}
            lessonSlug={lessonSlug || commonLesson || ''}
            onModuleChange={(value) => { setModuleSlug(value); setLessonSlug(''); }}
            onLessonChange={setLessonSlug}
          />
        </FormRow>

        <Separator />

        {/* ─── Row: When (Date + Time + AM/PM) — Zoom style ─── */}
        <FormRow
          icon={<Calendar className="h-4 w-4" />}
          label={t('staff.teacher.session.when_label', { defaultValue: 'When' })}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-[160px]"
            />
            <div className="flex items-center border rounded-md overflow-hidden bg-background">
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="w-[68px] border-0 rounded-none focus:ring-0 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground font-bold px-0.5">:</span>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger className="w-[68px] border-0 rounded-none focus:ring-0 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex border-s">
                <button
                  type="button"
                  onClick={() => setAmpm('AM')}
                  className={`px-2.5 py-2 text-xs font-semibold transition-colors ${ampm === 'AM' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setAmpm('PM')}
                  className={`px-2.5 py-2 text-xs font-semibold transition-colors ${ampm === 'PM' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>
        </FormRow>

        <Separator />

        {/* ─── Row: Recurrence ─── */}
        <FormRow
          icon={<Repeat className="h-4 w-4" />}
          label={t('staff.teacher.session.recurrence_label', { defaultValue: 'Repeat' })}
        >
          <div className="space-y-3">
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {recurrence === 'custom_days' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        setCustomDays(prev => {
                          const next = new Set(prev);
                          if (next.has(day.value)) next.delete(day.value);
                          else next.add(day.value);
                          return next;
                        });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        customDays.has(day.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {t(day.labelKey, { defaultValue: day.defaultLabel })}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('staff.teacher.session.for_weeks', { defaultValue: 'For' })}
                  </span>
                  <Select value={String(customWeeks)} onValueChange={(v) => setCustomWeeks(parseInt(v))}>
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6, 8, 12].map(w => (
                        <SelectItem key={w} value={String(w)}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    {t('staff.teacher.session.weeks', { defaultValue: 'weeks' })}
                  </span>
                </div>
              </div>
            )}

            {recurrence !== 'none' && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/10">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {t('staff.teacher.session.will_create_count', {
                    defaultValue: '{{count}} sessions will be created',
                    count: String(totalSessions),
                  })}
                </p>
              </div>
            )}
          </div>
        </FormRow>


        <FormRow
          icon={<Clock className="h-4 w-4" />}
          label={t('staff.teacher.session.duration_label', { defaultValue: 'Duration' })}
        >
          <div className="flex items-center gap-2">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {t('staff.teacher.session.minutes', { defaultValue: 'min' })}
            </span>
          </div>
        </FormRow>

        <Separator />

        {/* ─── Row: Timezone ─── */}
        <FormRow
          icon={<Globe className="h-4 w-4" />}
          label={t('staff.teacher.session.timezone_label', { defaultValue: 'Time Zone' })}
        >
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="max-w-xs">
              <SelectValue>{tzLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>

        <Separator />

        {/* ─── Row: Zoom Link ─── */}
        <FormRow
          icon={<Video className="h-4 w-4" />}
          label={t('staff.teacher.session.zoom_label', { defaultValue: 'Zoom Link' })}
          optional
        >
          <Input
            value={zoomLink}
            onChange={(e) => setZoomLink(e.target.value)}
            placeholder="https://zoom.us/j/..."
            className="max-w-md"
          />
        </FormRow>
      </div>

      {/* ─── Actions ─── */}
      <div className="flex items-center gap-3 mt-8 pt-6 border-t">
        <Button
          onClick={handleCreate}
          disabled={submitting || !selectedStudents.length}
          className="min-w-[160px]"
          size="lg"
        >
          {submitting
            ? t('common.submitting', { defaultValue: 'Submitting...' })
            : totalSessions > 1
              ? t('staff.teacher.session.create_batch_btn', { defaultValue: 'Schedule {{count}} Sessions', count: String(totalSessions) })
              : t('staff.teacher.session.create_btn', { defaultValue: 'Schedule Session' })
          }
        </Button>
        <Button variant="outline" onClick={onCancel} size="lg">
          {t('staff.teacher.session.cancel', { defaultValue: 'Cancel' })}
        </Button>
        {!selectedStudents.length && (
          <p className="text-xs text-destructive ms-2">
            {t('staff.teacher.session.select_at_least_one', { defaultValue: 'Select at least one student' })}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Reusable form row (Zoom-style horizontal layout) ─── */
function FormRow({
  icon, label, children, optional, badge,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  optional?: boolean;
  badge?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-4 py-4">
      <div className="flex items-start gap-2 min-w-[140px] shrink-0 pt-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">
          {label}
          {badge && (
            <Badge variant="secondary" className="ms-1.5 text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
          {optional && (
            <span className="text-xs text-muted-foreground font-normal ms-1">
              ({t('common.optional', { defaultValue: 'optional' })})
            </span>
          )}
        </span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
