/**
 * useTeacherApproval — Local-first teacher approval state.
 * Reads from local teacher_state_cache via useTeacherState.
 * No live CRM call on every mount.
 */
import { useMemo } from 'react';
import { useTeacherState, type TeacherState } from '@/hooks/useTeacherState';

export interface TeacherApprovalState {
  /** Whether the teacher can perform teaching actions */
  canTeach: boolean;
  /** CRM approval status: approved | pending | rejected | suspended */
  approvalStatus: string | null;
  /** Whether identity documents are verified */
  identityVerified: boolean;
  /** Whether education credentials are verified */
  educationVerified: boolean;
  /** List of specific blockers preventing can_teach=true */
  blockers: string[];
  /** Loading state */
  loading: boolean;
  /** Whether resolution completed */
  resolved: boolean;
  /** Refresh approval state (triggers CRM re-sync only if stale) */
  refresh: () => void;
}

export function useTeacherApproval(isTeacherCapable: boolean): TeacherApprovalState {
  const teacherState = useTeacherState(isTeacherCapable);

  return useMemo<TeacherApprovalState>(() => {
    if (!isTeacherCapable) {
      return {
        canTeach: false,
        approvalStatus: null,
        identityVerified: false,
        educationVerified: false,
        blockers: ['not_teacher_role'],
        loading: false,
        resolved: true,
        refresh: teacherState.refresh,
      };
    }

    return {
      canTeach: teacherState.canTeach,
      approvalStatus: teacherState.approvalStatus,
      identityVerified: teacherState.identityVerified,
      educationVerified: teacherState.educationVerified,
      blockers: teacherState.blockers,
      loading: teacherState.loading,
      resolved: teacherState.resolved,
      refresh: teacherState.refresh,
    };
  }, [
    isTeacherCapable,
    teacherState.canTeach,
    teacherState.approvalStatus,
    teacherState.identityVerified,
    teacherState.educationVerified,
    teacherState.blockers,
    teacherState.loading,
    teacherState.resolved,
    teacherState.refresh,
  ]);
}
