import { useEffect, useState } from 'react';
import { getRussianExamLaunchPayload } from '@/lib/russianAssessmentExecution';
import type { RussianExamLaunchPayload, RussianExamSetKey } from '@/types/russianAssessmentExecution';

export function useRussianExamLaunch(userId: string | null, examSetKey: RussianExamSetKey) {
  const [data, setData] = useState<RussianExamLaunchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getRussianExamLaunchPayload(userId, examSetKey)
      .then((payload) => { if (active) setData(payload); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'exam_launch_failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, examSetKey]);

  return { data, loading, error };
}
