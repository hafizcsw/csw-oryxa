import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardProgressTab } from '@/components/languages/dashboard/DashboardProgressTab';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@/lib/languageCourseI18n', () => ({
  translateLanguageCourseValue: (_t: unknown, _key: string, value: string) => value,
}));

describe('DashboardProgressTab phase preview rendering', () => {
  it('renders phase 1A/1B/1C/full preview cards and local-preview labels', () => {
    render(
      <DashboardProgressTab
        studyStats={{ weeklyGoalMinutes: 0, weeklyMinutesDone: 0, streakDays: 0 } as any}
        vocabCount={0}
        enrollment={null}
        pathModules={[]}
        releasedLessons={[]}
        courseState={null}
        phase1a={{
          phaseLessonsTotal: 10,
          phaseLessonsCompleted: 2,
          vocabTotal: 30,
          vocabFromCompletedLessons: 6,
          coreVocabTotal: 12,
          readinessSignal: 'starting',
          source: 'local_preview',
          laneProgress: { literacy: 1, classroom_foundation: 1 },
        }}
        phase1b={{
          phaseLessonsTotal: 10,
          phaseLessonsCompleted: 2,
          vocabTotal: 30,
          recyclableVocab: 10,
          activeVocab: 8,
          canDoReadyLessons: 2,
          source: 'local_preview',
        }}
        phase1c={{
          phaseLessonsTotal: 10,
          phaseLessonsCompleted: 2,
          checkpointLessonsTotal: 6,
          checkpointLessonsCompleted: 1,
          source: 'local_preview',
        }}
        phase1Full={{
          totalLessons: 30,
          completedLessons: 4,
          lessonsWithCanDo: 30,
          lessonsWithScenario: 20,
          source: 'local_preview',
        }}
      />
    );

    expect(screen.getByText('languages.dashboard.phase1a.title')).toBeInTheDocument();
    expect(screen.getByText('languages.dashboard.phase1b.title')).toBeInTheDocument();
    expect(screen.getByText('languages.dashboard.phase1c.title')).toBeInTheDocument();
    expect(screen.getByText('languages.dashboard.phase1full.title')).toBeInTheDocument();

    expect(screen.getByText(/2\/10/)).toBeInTheDocument();
    expect(screen.getByText(/1\/6/)).toBeInTheDocument();
    expect(screen.getByText(/4\/30/)).toBeInTheDocument();

    expect(screen.getAllByText(/local runtime fallback and not authoritative server truth/i).length).toBeGreaterThan(0);
  });
});
