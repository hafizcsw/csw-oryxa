import { useState } from 'react';
import { submitRussianCheckpointAttempt } from '@/lib/russianAssessmentExecution';
import type { RussianCheckpointSubmitInput } from '@/types/russianAssessmentExecution';

export function useRussianCheckpointSubmit(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: RussianCheckpointSubmitInput) => {
    if (!userId) throw new Error('missing_user');
    setLoading(true);
    setError(null);
    try {
      return await submitRussianCheckpointAttempt(userId, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'checkpoint_submit_failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}
