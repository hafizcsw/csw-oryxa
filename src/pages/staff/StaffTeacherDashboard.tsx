/**
 * StaffTeacherDashboard — Professional in-flow teacher cockpit.
 * Now uses Busuu-style top navigation bar.
 */
import { useState, useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuthority } from '@/hooks/useStaffAuthority';
import { useTeacherStudents } from '@/hooks/useTeacherStudents';
import { useTeacherPermissions } from '@/lib/teacherPermissions';
import { useTeacherApproval } from '@/hooks/useTeacherApproval';
import { useTeacherSessionPrep } from '@/hooks/useTeacherSessionPrep';
import { useTeacherSessions } from '@/hooks/useTeacherSessions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCommUnreadCount } from '@/hooks/useCommApi';
import { commCreateThread } from '@/hooks/useCommApi';
import { buildAvatarDisplayUrl } from '@/features/avatar/avatarImageUtils';
import { PageLoader } from '@/components/ui/PageLoader';
import { TeacherHomeCockpit } from '@/components/staff/teacher/TeacherHomeCockpit';
import { TeacherStudentList } from '@/components/staff/teacher/TeacherStudentList';
import { TeacherStudentWorkspace } from '@/components/staff/teacher/TeacherStudentWorkspace';
import { TeacherSessionCreate } from '@/components/staff/teacher/TeacherSessionCreate';
import { TeacherCalendarOS } from '@/components/staff/teacher/TeacherCalendarOS';
import { TeacherSessionDetailView } from '@/components/staff/teacher/TeacherSessionDetail';
import { TeacherApprovalGate } from '@/components/staff/teacher/TeacherApprovalGate';
import { TeacherProfileManager } from '@/components/staff/teacher/TeacherProfileManager';
import { TeacherSettingsPanel } from '@/components/staff/teacher/TeacherSettingsPanel';
import { TeacherReviewQueue } from '@/components/staff/teacher/TeacherReviewQueue';
import { useTeacherOpsSettings } from '@/hooks/useTeacherOpsSettings';
import { TeacherAiFollowupPanel } from '@/components/staff/teacher/TeacherAiFollowupPanel';
import { TeacherExamModePanel } from '@/components/staff/teacher/TeacherExamModePanel';
import { TeacherAiCopilotPanel } from '@/components/staff/teacher/TeacherAiCopilotPanel';
import { TeacherPlanBuilder } from '@/components/staff/teacher/TeacherPlanBuilder';
import { TeacherCommPanel } from '@/components/comm/TeacherCommPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BusuuNavBar, type BusuuNavTab } from '@/components/languages/dashboard/BusuuNavBar';
import {
  LayoutDashboard, Users, CalendarDays, MessageCircle, Bot, ClipboardList,
  UserCircle, Settings, Plus
} from 'lucide-react';

type SubView = 'none' | 'student-detail' | 'session-create' | 'session-detail';

export default function StaffTeacherDashboard() {
  const { isStaff, role, email, loading: authLoading, resolved } = useStaffAuthority();
  const permissions = useTeacherPermissions(role);
  const approval = useTeacherApproval(permissions.isTeacherCapable);
  const { t } = useLanguage();
  const { students, loading: studentsLoading, refresh: refreshStudents } = useTeacherStudents();
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useTeacherSessions();
  const [teacherProfile, setTeacherProfile] = useState<{ full_name: string | null; avatar_storage_path: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_storage_path')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) setTeacherProfile(data);
    })();
  }, []);
  const sessionPrep = useTeacherSessionPrep();
  const { count: unreadMessages } = useCommUnreadCount();
  const navigate = useNavigate();
  const { settings } = useTeacherOpsSettings();

  const [activeView, setActiveView] = useState('home');
  const [subView, setSubView] = useState<SubView>('none');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [initialConversation, setInitialConversation] = useState<{
    id: string; name?: string; avatar?: string;
  } | null>(null);
  const [teacherPublicId, setTeacherPublicId] = useState<string | undefined>(undefined);

  // Track which views have been mounted at least once (lazy mount)
  const [mountedViews, setMountedViews] = useState<Set<string>>(new Set(['home']));

  useEffect(() => {
    setMountedViews(prev => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) setTeacherPublicId(data.session.user.id);
    });
  }, []);

  if (authLoading || !resolved) return <PageLoader />;
  if (!isStaff || !permissions.isTeacherCapable) return <Navigate to="/" replace />;

  const handleRefresh = () => { refreshStudents(); refreshSessions(); };
  const loading = studentsLoading || sessionsLoading;

  const handleMessageStudent = async (studentUserId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      const result = await commCreateThread({
        thread_type: 'teacher_student',
        first_message: '…',
        participants: [{ user_id: studentUserId, role: 'student' }],
      });
      if (result?.thread_id) {
        setInitialConversation({ id: result.thread_id });
        setActiveView('messages');
        setSubView('none');
      }
    } catch (e) {
      console.error('Failed to create teacher thread', e);
    }
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSubView('student-detail');
  };

  const handleCreateSession = () => {
    setSubView('session-create');
  };

  const handleSessionCreated = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSubView('session-detail');
    sessionPrep.clearSelection();
    refreshSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSubView('session-detail');
  };

  const handleBackToMain = () => {
    setSubView('none');
    setSelectedStudentId(null);
    setSelectedSessionId(null);
  };

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setSubView('none');
    setSelectedStudentId(null);
    setSelectedSessionId(null);
  };




  const renderSubView = () => {
    if (subView === 'student-detail' && selectedStudentId) {
      return (
        <TeacherStudentWorkspace
          studentUserId={selectedStudentId}
          permissions={permissions}
          onBack={handleBackToMain}
          onCreateSession={(uid) => {
            sessionPrep.toggleStudent(uid);
            setSubView('session-create');
          }}
          onSelectSession={handleSelectSession}
          sessions={sessions}
        />
      );
    }

    if (subView === 'session-create') {
      const selectedStudentObjs = students.filter(s =>
        sessionPrep.selectedStudentIds.includes(s.user_id)
      );
      return (
        <TeacherSessionCreate
          selectedStudents={selectedStudentObjs}
          onCreated={handleSessionCreated}
          onCancel={handleBackToMain}
        />
      );
    }

    if (subView === 'session-detail' && selectedSessionId) {
      return (
        <TeacherSessionDetailView
          sessionId={selectedSessionId}
          permissions={permissions}
          onBack={handleBackToMain}
        />
      );
    }

    return null;
  };

  const hasSubView = subView !== 'none';

  const teacherTabs: BusuuNavTab[] = [
    { id: 'home', icon: LayoutDashboard, labelKey: 'staff.teacher.sidebar.home', badge: 0 },
    { id: 'students', icon: Users, labelKey: 'staff.teacher.sidebar.students', badge: students.length > 0 ? students.length : 0 },
    { id: 'sessions', icon: CalendarDays, labelKey: 'staff.teacher.sidebar.sessions', badge: sessions.filter(s => s.status === 'scheduled' || s.status === 'draft').length || 0 },
    { id: 'messages', icon: MessageCircle, labelKey: 'staff.teacher.sidebar.messages', badge: unreadMessages || 0 },
    { id: 'plans', icon: ClipboardList, labelKey: 'staff.teacher.sidebar.plans', badge: 0 },
    { id: 'copilot', icon: Bot, labelKey: 'staff.teacher.sidebar.copilot', badge: 0 },
    { id: 'profile', icon: UserCircle, labelKey: 'staff.teacher.sidebar.my_profile', badge: 0 },
    { id: 'settings', icon: Settings, labelKey: 'staff.teacher.sidebar.settings', badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <BusuuNavBar
        tabs={teacherTabs}
        activeTab={activeView}
        onTabChange={handleNavigate}
        notificationCount={unreadMessages || 0}
      />

      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Sub-views (overlays) rendered on top */}
          {hasSubView && renderSubView()}

          {/* Main views — show/hide to preserve state */}
          <div style={{ display: hasSubView ? 'none' : undefined }}>
            {/* HOME */}
            <div style={{ display: activeView === 'home' ? undefined : 'none' }}>
              {studentsLoading && !students.length ? <PageLoader /> : (
                <div className="space-y-6">
                  <TeacherApprovalGate approval={approval} />
                  {approval.canTeach && sessionPrep.selectionCount > 0 && (
                    <SessionPrepBar
                      t={t}
                      count={sessionPrep.selectionCount}
                      onCreate={handleCreateSession}
                      onClear={sessionPrep.clearSelection}
                    />
                  )}
                  <TeacherHomeCockpit
                    students={students}
                    sessions={sessions}
                    onSelectStudent={handleSelectStudent}
                    onSelectSession={handleSelectSession}
                    onCreateSession={handleCreateSession}
                    onSwitchTab={handleNavigate}
                  />
                  <TeacherReviewQueue
                    students={students}
                    sessions={sessions}
                    onSelectStudent={handleSelectStudent}
                    onSelectSession={handleSelectSession}
                  />
                </div>
              )}
            </div>

            {/* STUDENTS */}
            {mountedViews.has('students') && (
              <div style={{ display: activeView === 'students' ? undefined : 'none' }}>
                {studentsLoading && !students.length ? <PageLoader /> : (
                  <div className="space-y-4">
                    {approval.canTeach && sessionPrep.selectionCount > 0 && (
                      <SessionPrepBar
                        t={t}
                        count={sessionPrep.selectionCount}
                        onCreate={handleCreateSession}
                        onClear={sessionPrep.clearSelection}
                      />
                    )}
                    <TeacherStudentList
                      students={students}
                      permissions={permissions}
                      onSelectStudent={handleSelectStudent}
                      onMessageStudent={handleMessageStudent}
                      sessionPrep={sessionPrep}
                    />
                  </div>
                )}
              </div>
            )}

            {/* SESSIONS */}
            {mountedViews.has('sessions') && (
              <div style={{ display: activeView === 'sessions' ? undefined : 'none' }}>
                <TeacherCalendarOS onSelectSession={handleSelectSession} sessions={sessions} />
              </div>
            )}

            {/* MESSAGES */}
            {mountedViews.has('messages') && (
              <div style={{ display: activeView === 'messages' ? undefined : 'none' }}>
                <TeacherCommPanel
                  className="h-[calc(100vh-200px)]"
                  initialConversationId={initialConversation?.id}
                />
              </div>
            )}

            {/* PLANS */}
            {mountedViews.has('plans') && (
              <div style={{ display: activeView === 'plans' ? undefined : 'none' }}>
                {selectedStudentId ? (
                  <TeacherPlanBuilder studentUserId={selectedStudentId} teacherType={settings.teacherType} />
                ) : (
                  <TeacherStudentList
                    students={students}
                    permissions={permissions}
                    onSelectStudent={(id) => { setSelectedStudentId(id); setActiveView('plans'); }}
                    onMessageStudent={handleMessageStudent}
                    sessionPrep={sessionPrep}
                  />
                )}
              </div>
            )}

            {/* COPILOT */}
            {mountedViews.has('copilot') && (
              <div style={{ display: activeView === 'copilot' ? undefined : 'none' }}>
                {selectedStudentId ? (
                  <div className="space-y-4">
                    <TeacherAiCopilotPanel
                      studentUserId={selectedStudentId}
                      studentName={students.find(s => s.user_id === selectedStudentId)?.full_name}
                      teacherType={settings.teacherType}
                      sessions={sessions}
                    />
                    <TeacherAiFollowupPanel studentUserId={selectedStudentId} />
                    <TeacherExamModePanel studentUserId={selectedStudentId} />
                  </div>
                ) : (
                  <TeacherStudentList
                    students={students}
                    permissions={permissions}
                    onSelectStudent={(id) => { setSelectedStudentId(id); setActiveView('copilot'); }}
                    onMessageStudent={handleMessageStudent}
                    sessionPrep={sessionPrep}
                  />
                )}
              </div>
            )}

            {/* PROFILE */}
            {mountedViews.has('profile') && (
              <div style={{ display: activeView === 'profile' ? undefined : 'none' }}>
                <TeacherProfileManager teacherId={teacherPublicId} />
              </div>
            )}

            {/* SETTINGS */}
            {mountedViews.has('settings') && (
              <div style={{ display: activeView === 'settings' ? undefined : 'none' }}>
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">
                    {t('staff.teacher.settings.title', { defaultValue: 'Teaching Operating Settings' })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('staff.teacher.settings.description', { defaultValue: 'Control teacher type emphasis, exam intensity defaults, and review workflow policies.' })}
                  </p>
                  <TeacherSettingsPanel />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SessionPrepBar({ t, count, onCreate, onClear }: {
  t: (key: string, options?: Record<string, unknown>) => string; count: number; onCreate: () => void; onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-primary/5 border border-primary/20">
      <Users className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">
        {t('staff.teacher.selected_count', { count })}
      </span>
      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
        {t('staff.teacher.session_prep')}
      </Badge>
      <div className="flex-1" />
      <Button
        variant="default"
        size="sm"
        onClick={onCreate}
        className="bg-gradient-to-r from-primary to-primary/80 hover:-translate-y-0.5 active:scale-[0.97] transition-all"
      >
        <Plus className="h-3.5 w-3.5 me-1.5" />
        {t('staff.teacher.session.create_btn')}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        {t('staff.teacher.clear_selection')}
      </Button>
    </div>
  );
}
