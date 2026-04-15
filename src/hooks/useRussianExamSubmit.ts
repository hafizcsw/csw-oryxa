import { useState } from 'react';
import { submitRussianExamAttempt } from '@/lib/russianAssessmentExecution';
import type { RussianExamSubmitInput } from '@/types/russianAssessmentExecution';

export function useRussianExamSubmit(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: RussianExamSubmitInput) => {
    if (!userId) throw new Error('missing_user');
    setLoading(true);
    setError(null);
    try {
      return await submitRussianExamAttempt(userId, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'exam_submit_failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}
