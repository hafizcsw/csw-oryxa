/**
 * useTeacherSessionPrep — Minimal state scaffolding for future session management.
 * Tracks selected students and draft session state.
 * Does NOT implement Zoom, groups, or attendance.
 * Exists solely to avoid rework when sessions are built.
 */
import { useState, useCallback } from 'react';

export interface TeacherSessionDraft {
  selectedStudentIds: string[];
  languageKey: string;
  /** Future: session type, scheduled time, etc. */
}

export function useTeacherSessionPrep(languageKey = 'russian') {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const toggleStudent = useCallback((userId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const selectAll = useCallback((userIds: string[]) => {
    setSelectedStudentIds(userIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedStudentIds([]);
  }, []);

  const getSessionDraft = useCallback((): TeacherSessionDraft => ({
    selectedStudentIds,
    languageKey,
  }), [selectedStudentIds, languageKey]);

  return {
    selectedStudentIds,
    selectionCount: selectedStudentIds.length,
    toggleStudent,
    selectAll,
    clearSelection,
    getSessionDraft,
    isStudentSelected: (id: string) => selectedStudentIds.includes(id),
  };
}
