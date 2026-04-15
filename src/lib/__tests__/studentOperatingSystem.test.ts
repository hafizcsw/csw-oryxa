import { describe, it, expect } from 'vitest';
import { buildStudentOperatingSystemData, mapTeacherRole } from '@/lib/studentOperatingSystem';

describe('studentOperatingSystem', () => {
  it('maps teacher roles without mixing exam and language teachers', () => {
    expect(mapTeacherRole('exam_sprint')).toBe('curriculum_exam_teacher');
    expect(mapTeacherRole('regular_lesson')).toBe('language_teacher');
  });

  it('builds emergency exam mode with urgent recovery queue', () => {
    const data = buildStudentOperatingSystemData({
      sessions: [
        {
          id: 's1',
          status: 'scheduled',
          scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
          session_type: 'exam_sprint',
          lesson_slug: 'lesson-1',
          module_slug: 'module-1',
          zoom_link: 'https://zoom.test/join',
          summary: null,
          next_action: null,
          teacher_user_id: 't1',
        },
      ],
      sessionNotes: [{ session_id: 's1', summary: 'recap', next_action: 'review' }],
      evaluations: [],
      teacherNames: { t1: 'Teacher 1' },
      attendanceBySessionId: { s1: null },
      assignments: [
        {
          id: 'a1',
          title: 'HW',
          description: null,
          instructions: null,
          module_slug: null,
          lesson_slug: null,
          due_date: new Date(Date.now() - 86400000).toISOString(),
          status: 'overdue',
          submission_text: null,
          submission_file_url: null,
          submission_notes: null,
          submitted_at: null,
          feedback: null,
          score: null,
          created_at: null,
        },
      ],
      examNotices: [
        {
          id: 'e1',
          title: 'Exam',
          exam_type: 'final',
          description: null,
          module_coverage: null,
          scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
          status: 'upcoming',
          preparation_note: null,
          external_link: null,
        },
      ],
      enrollment: null,
      dashboardData: null,
      studyStats: { totalMinutes: 0, sessionsCount: 0, weeklyMinutes: 0, daysActive: 2, weekLessons: 0, weekSessions: 0 },
      completedLessons: 3,
      totalLessons: 20,
      aiRecapUsage: 2,
    });

    expect(data.planHealth.state).toBe('emergency_exam_mode');
    expect(data.queue.some((item) => item.type === 'exam_recovery')).toBe(true);
    expect(data.teacherRoles[0]?.role).toBe('curriculum_exam_teacher');
  });
});
