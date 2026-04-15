import { useEffect, useState } from 'react';
import { getRussianCheckpointLaunchPayload } from '@/lib/russianAssessmentExecution';
import type { RussianCheckpointLaunchPayload, RussianCheckpointTemplateKey } from '@/types/russianAssessmentExecution';

export function useRussianCheckpointLaunch(userId: string | null, templateKey: RussianCheckpointTemplateKey) {
  const [data, setData] = useState<RussianCheckpointLaunchPayload | null>(null);
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
    getRussianCheckpointLaunchPayload(userId, templateKey)
      .then((payload) => { if (active) setData(payload); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'checkpoint_launch_failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, templateKey]);

  return { data, loading, error };
}
