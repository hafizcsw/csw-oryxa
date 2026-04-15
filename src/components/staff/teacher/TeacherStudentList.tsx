/**
 * TeacherStudentList — Zoom-inspired clean student list with avatars.
 */
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageCircle, ChevronRight, User } from 'lucide-react';
import { useUserPresence, getLastSeenText } from '@/hooks/usePresence';
import { buildAvatarDisplayUrl } from '@/features/avatar/avatarImageUtils';
import type { TeacherStudent } from '@/hooks/useTeacherStudents';
import type { TeacherPermissions } from '@/lib/teacherPermissions';

interface TeacherStudentListProps {
  students: TeacherStudent[];
  permissions: TeacherPermissions;
  onSelectStudent: (userId: string) => void;
  onMessageStudent?: (userId: string) => void;
  sessionPrep: {
    selectedStudentIds: string[];
    toggleStudent: (id: string) => void;
    isStudentSelected: (id: string) => boolean;
  };
}

export function TeacherStudentList({ students, permissions, onSelectStudent, onMessageStudent, sessionPrep }: TeacherStudentListProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const studentUserIds = useMemo(() => students.map(s => s.user_id), [students]);
  const presenceMap = useUserPresence(studentUserIds);

  const modules = useMemo(() => {
    const set = new Set(students.map(s => s.current_module).filter(Boolean));
    return Array.from(set) as string[];
  }, [students]);

  const lessons = useMemo(() => {
    const set = new Set(students.map(s => s.current_lesson).filter(Boolean));
    return Array.from(set) as string[];
  }, [students]);

  const getActivityState = (latest: string | null): 'active' | 'recent' | 'inactive' | 'never' => {
    if (!latest) return 'never';
    const days = Math.floor((Date.now() - new Date(latest).getTime()) / 86400000);
    if (days <= 3) return 'active';
    if (days <= 14) return 'recent';
    return 'inactive';
  };

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = s.full_name?.toLowerCase().includes(q);
        const emailMatch = s.email?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      if (moduleFilter !== 'all' && s.current_module !== moduleFilter) return false;
      if (lessonFilter !== 'all' && s.current_lesson !== lessonFilter) return false;
      if (statusFilter !== 'all' && s.enrollment_status !== statusFilter) return false;
      if (activityFilter !== 'all' && getActivityState(s.latest_activity) !== activityFilter) return false;
      return true;
    });
  }, [students, search, moduleFilter, lessonFilter, statusFilter, activityFilter]);

  const ACTIVITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-[#E6F4EA]', text: 'text-[#188038]', label: t('staff.teacher.activity.active', { defaultValue: 'Active' }) },
    recent: { bg: 'bg-[#FEF7E0]', text: 'text-[#B06000]', label: t('staff.teacher.activity.recent', { defaultValue: 'Recent' }) },
    inactive: { bg: 'bg-[#F1F3F4]', text: 'text-[#5F6368]', label: t('staff.teacher.activity.inactive', { defaultValue: 'Inactive' }) },
    never: { bg: 'bg-[#F1F3F4]', text: 'text-[#80868B]', label: t('staff.teacher.activity.never', { defaultValue: 'No activity' }) },
  };

  if (!permissions.can('can_view_russian_students')) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t('staff.teacher.no_permission', { defaultValue: 'You do not have permission to view students.' })}
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder={t('staff.teacher.search_placeholder', { defaultValue: 'Search students...' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-8 h-8 text-[13px] bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-[#0E71EB]/30"
          />
        </div>
        <CompactSelect value={moduleFilter} onChange={setModuleFilter} placeholder={t('staff.teacher.all_modules', { defaultValue: 'All Modules' })} options={modules.map(m => ({ value: m, label: m }))} allLabel={t('staff.teacher.all_modules', { defaultValue: 'All Modules' })} />
        <CompactSelect value={lessonFilter} onChange={setLessonFilter} placeholder={t('staff.teacher.all_lessons', { defaultValue: 'All Lessons' })} options={lessons.map(l => ({ value: l, label: l }))} allLabel={t('staff.teacher.all_lessons', { defaultValue: 'All Lessons' })} />
        <CompactSelect value={activityFilter} onChange={setActivityFilter} placeholder={t('staff.teacher.all_activity', { defaultValue: 'All' })} options={[
          { value: 'active', label: t('staff.teacher.activity.active', { defaultValue: 'Active' }) },
          { value: 'recent', label: t('staff.teacher.activity.recent', { defaultValue: 'Recent' }) },
          { value: 'inactive', label: t('staff.teacher.activity.inactive', { defaultValue: 'Inactive' }) },
          { value: 'never', label: t('staff.teacher.activity.never', { defaultValue: 'No activity' }) },
        ]} allLabel={t('staff.teacher.all_activity', { defaultValue: 'All' })} />
        <CompactSelect value={statusFilter} onChange={setStatusFilter} placeholder={t('staff.teacher.all_statuses', { defaultValue: 'All Statuses' })} options={[
          { value: 'active', label: t('staff.teacher.status_active', { defaultValue: 'Active' }) },
          { value: 'pending', label: t('staff.teacher.status_pending', { defaultValue: 'Pending' }) },
          { value: 'inactive', label: t('staff.teacher.status_inactive', { defaultValue: 'Inactive' }) },
        ]} allLabel={t('staff.teacher.all_statuses', { defaultValue: 'All Statuses' })} />
      </div>

      {/* ── Count ── */}
      <p className="text-[11px] text-muted-foreground">
        {t('staff.teacher.showing_students', { defaultValue: '{{count}} students', count: filtered.length })}
      </p>

      {/* ── Student Cards ── */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground rounded-lg border bg-card">
            {t('staff.teacher.no_students', { defaultValue: 'No students found' })}
          </div>
        ) : (
          filtered.map((student) => {
            const presence = presenceMap[student.user_id];
            const isOnline = presence?.is_online || false;
            const lastSeenLabel = presence
              ? getLastSeenText(presence.last_seen_at, t)
              : t('chat.offline', { defaultValue: 'Offline' });
            const actState = getActivityState(student.latest_activity);
            const actStyle = ACTIVITY_STYLES[actState];
            const isSelected = sessionPrep.isStudentSelected(student.user_id);
            const avatarUrl = buildAvatarDisplayUrl(student.avatar_storage_path);

            const displayName = student.full_name || (() => {
              if (student.email?.includes('@portal.csw.local')) {
                return `+${student.email.split('@')[0]}`;
              }
              return student.email?.split('@')[0] || t('staff.teacher.unnamed', { defaultValue: 'Unnamed' });
            })();

            return (
              <div
                key={student.user_id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-all cursor-pointer ${
                  isSelected ? 'ring-1 ring-[#0E71EB]/40 bg-[#0E71EB]/[0.03]' : 'border-border/60'
                }`}
                onClick={() => onSelectStudent(student.user_id)}
              >
                {/* Checkbox */}
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => sessionPrep.toggleStudent(student.user_id)}
                    className="h-4 w-4"
                  />
                </div>

                {/* Avatar with presence dot */}
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-[11px] font-medium bg-muted text-muted-foreground">
                      {getInitials(student.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card ${
                    isOnline ? 'bg-[#33B679]' : 'bg-muted-foreground/30'
                  }`} />
                </div>

                {/* Name & status */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium truncate">{displayName}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${actStyle.bg} ${actStyle.text}`}>
                      {actStyle.label}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      student.enrollment_status === 'active' ? 'bg-[#E6F4EA] text-[#188038]' : 'bg-[#F1F3F4] text-[#5F6368]'
                    }`}>
                      {student.enrollment_status}
                    </span>
                  </div>
                  <p className={`text-[11px] ${isOnline ? 'text-[#188038]' : 'text-muted-foreground/60'}`}>{lastSeenLabel}</p>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
                  <div className="text-center">
                    <p className="text-[13px] font-semibold tabular-nums text-foreground/80">{student.lessons_completed}</p>
                    <p className="text-[9px] uppercase tracking-wider">{t('staff.teacher.col_completed', { defaultValue: 'Done' })}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold tabular-nums text-foreground/80">{student.words_learned}/{student.total_vocab}</p>
                    <p className="text-[9px] uppercase tracking-wider">{t('staff.teacher.col_vocab', { defaultValue: 'Words' })}</p>
                  </div>
                  {student.placement_score !== null && (
                    <div className="text-center">
                      <p className="text-[13px] font-semibold tabular-nums text-[#0E71EB]">{student.placement_score}%</p>
                      <p className="text-[9px] uppercase tracking-wider">{t('staff.teacher.col_placement', { defaultValue: 'Level' })}</p>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground/60 truncate max-w-[90px]">
                    {student.current_module || '—'}
                  </div>
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {onMessageStudent ? (
                    <button
                      className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-[#0E71EB] hover:bg-[#0E71EB]/5 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onMessageStudent(student.user_id); }}
                      title={t('chat.sendMessage', { defaultValue: 'Send message' })}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Compact filter select ── */
function CompactSelect({ value, onChange, placeholder, options, allLabel }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px] w-auto min-w-[100px] max-w-[150px] bg-muted/30 border-0 focus:ring-1 focus:ring-[#0E71EB]/30 gap-1 px-2.5">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-[12px]">{allLabel}</SelectItem>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
