/**
 * Staff Authority Types
 * Portal consumes these from CRM — Portal does NOT own staff authority.
 */

/** Staff roles as defined in CRM authority source */
export type StaffRole =
  | 'super_admin'
  | 'teacher'
  | 'editor'
  | 'content_staff';

/** CRM access scope — determines where this staff member can operate */
export type AccessScope = 'crm_only' | 'portal_only' | 'crm_and_portal';

/** Whether a given scope includes Portal access */
export function scopeIncludesPortal(scope: AccessScope | null | undefined): boolean {
  return scope === 'portal_only' || scope === 'crm_and_portal';
}

/** Teacher approval truth merged from CRM when role=teacher */
export interface TeacherTruth {
  approvalStatus: string | null;
  identityVerified: boolean;
  educationVerified: boolean;
  canTeach: boolean;
  blockers: string[];
  fullName: string | null;
  phone: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  moreInfoReason: string | null;
}

/** Result of resolving staff authority from CRM */
export interface StaffAuthority {
  /** Whether the user has any staff role */
  isStaff: boolean;
  /** The specific role, null if not staff */
  role: StaffRole | null;
  /** CRM access scope */
  accessScope: AccessScope | null;
  /** User email for audit trail */
  email: string | null;
  /** Whether authority resolution is complete */
  resolved: boolean;
  /** Teacher approval truth (only present when role=teacher) */
  teacherTruth: TeacherTruth | null;
}

/** Landing path map per staff role */
export const STAFF_LANDING_PATHS: Record<StaffRole, string> = {
  super_admin: '/admin',
  teacher: '/staff/teacher',
  editor: '/staff/editor',
  content_staff: '/staff/content',
};

/** Route access map — which roles can access which route prefixes */
export const STAFF_ROUTE_ACCESS: Record<string, StaffRole[]> = {
  '/admin': ['super_admin'],
  '/staff/teacher': ['super_admin', 'teacher'],
  '/staff/editor': ['super_admin', 'editor', 'content_staff'],
  '/staff/content': ['super_admin', 'content_staff'],
  '/staff': ['super_admin', 'teacher', 'editor', 'content_staff'],
};
