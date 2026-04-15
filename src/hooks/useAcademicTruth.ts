// ═══════════════════════════════════════════════════════════════
// useAcademicTruth — Door 4: Academic truth hook
// ═══════════════════════════════════════════════════════════════
// Builds AcademicTruth from canonical file + subject rows.
// Integrates with Door 3 transcript analysis.
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import type { AcademicTruth, SubjectRow } from '@/features/academic-truth/types';
import { buildAcademicTruth } from '@/features/academic-truth/academic-truth-builder';
import { parseTranscriptSubjects } from '@/features/academic-truth/transcript-parser';

interface UseAcademicTruthOptions {
  canonicalFile: CanonicalStudentFile | null;
}

interface UseAcademicTruthResult {
  academicTruth: AcademicTruth;
  subjectRows: SubjectRow[];
  parseTranscript: (text: string, studentId: string, documentId: string) => SubjectRow[];
  addSubjectRows: (rows: SubjectRow[]) => void;
}

export function useAcademicTruth({ canonicalFile }: UseAcademicTruthOptions): UseAcademicTruthResult {
  const [manualSubjectRows, setManualSubjectRows] = useState<SubjectRow[]>([]);

  const parseTranscript = useCallback((text: string, studentId: string, documentId: string) => {
    const rows = parseTranscriptSubjects({ textContent: text, studentId, documentId });
    if (rows.length > 0) {
      setManualSubjectRows(prev => {
        // Replace rows from same document
        const filtered = prev.filter(r => r.source_document_id !== documentId);
        return [...filtered, ...rows];
      });
    }
    return rows;
  }, []);

  const addSubjectRows = useCallback((rows: SubjectRow[]) => {
    setManualSubjectRows(prev => [...prev, ...rows]);
  }, []);

  const academicTruth = useMemo(
    () => buildAcademicTruth(canonicalFile, manualSubjectRows),
    [canonicalFile, manualSubjectRows],
  );

  return {
    academicTruth,
    subjectRows: manualSubjectRows,
    parseTranscript,
    addSubjectRows,
  };
}
