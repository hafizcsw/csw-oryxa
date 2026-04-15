/**
 * Teacher Permission Adapter — Maps CRM staff roles to teacher-scoped actions.
 * Portal does NOT own permissions. This adapter derives teacher capabilities
 * from the CRM-resolved staff role at runtime.
 *
 * Permission map:
 *   teacher      → all teacher actions
 *   super_admin  → all teacher actions (superset)
 *   editor       → NO teacher actions
 *   content_staff→ NO teacher actions
 *   null (non-staff) → NO teacher actions
 */
import type { StaffRole } from '@/types/staff';

export type TeacherAction =
  | 'can_view_teacher_dashboard'
  | 'can_view_russian_students'
  | 'can_view_student_detail'
  | 'can_add_teacher_note'
  | 'can_open_lesson_context'
  | 'can_create_session'
  | 'can_manage_attendance'
  | 'can_save_evaluation'
  | 'can_save_outcome';

const TEACHER_ACTIONS: TeacherAction[] = [
  'can_view_teacher_dashboard',
  'can_view_russian_students',
  'can_view_student_detail',
  'can_add_teacher_note',
  'can_open_lesson_context',
  'can_create_session',
  'can_manage_attendance',
  'can_save_evaluation',
  'can_save_outcome',
];

/** Roles that have full teacher action access */
const TEACHER_CAPABLE_ROLES: StaffRole[] = ['teacher', 'super_admin'];

export interface TeacherPermissions {
  /** Whether this user has any teacher capability */
  isTeacherCapable: boolean;
  /** The CRM-resolved role powering these permissions */
  sourceRole: StaffRole | null;
  /** Check a specific action */
  can: (action: TeacherAction) => boolean;
  /** All resolved permissions as a map */
  permissionMap: Record<TeacherAction, boolean>;
}

/**
 * Resolve teacher permissions from CRM staff role.
 * Pure function — no side effects, no local storage.
 */
export function resolveTeacherPermissions(role: StaffRole | null): TeacherPermissions {
  const isTeacherCapable = role !== null && TEACHER_CAPABLE_ROLES.includes(role);

  const permissionMap = TEACHER_ACTIONS.reduce((map, action) => {
    map[action] = isTeacherCapable;
    return map;
  }, {} as Record<TeacherAction, boolean>);

  return {
    isTeacherCapable,
    sourceRole: role,
    can: (action: TeacherAction) => permissionMap[action] ?? false,
    permissionMap,
  };
}

/**
 * Hook-friendly adapter: use inside components that already have useStaffAuthority.
 */
export function useTeacherPermissions(role: StaffRole | null): TeacherPermissions {
  return resolveTeacherPermissions(role);
}
