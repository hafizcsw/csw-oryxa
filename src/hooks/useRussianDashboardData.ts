import { useEffect, useState } from 'react';
import { getRussianDashboardPayload, getRussianUnlockState, syncRussianLearnerState } from '@/lib/russianExecutionPackWriters';
import { getProgress } from '@/lib/russianCourse';
import { getFullPhase1Summary, getPhase1AVocabSummary, getPhase1BVocabSummary, getPhase1CSummary } from '@/lib/russianLessonRuntime';
import type { DashboardPayload, UnlockStatePayload } from '@/types/russianExecutionPack';

export function useRussianDashboardData(userId: string | null) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockStatePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const localProgress = getProgress().completedLessons;
  const phase1a = getPhase1AVocabSummary(localProgress);
  const phase1b = getPhase1BVocabSummary(localProgress);
  const phase1c = getPhase1CSummary(localProgress);
  const phase1Full = getFullPhase1Summary(localProgress);

  useEffect(() => {
    if (!userId) {
      setDashboard(null);
      setUnlocks(null);
      return;
    }

    let alive = true;
    setLoading(true);
    Promise.resolve()
      .then(() => syncRussianLearnerState(userId))
      .then(() => Promise.all([
        getRussianDashboardPayload(userId),
        getRussianUnlockState(userId),
      ]))
      .then(([dashboardPayload, unlockState]) => {
      if (!alive) return;
      setDashboard(dashboardPayload);
      setUnlocks(unlockState);
    }).catch((error) => {
      console.error('[useRussianDashboardData]', error);
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [userId]);

  return {
    dashboard,
    unlocks,
    loading,
    phase1a,
    phase1b,
    phase1c,
    phase1Full,
  };
}
