/**
 * TeacherIdentityHeader — Shows teacher authority state in the dashboard header.
 * Displays CRM-resolved role, authority state, and safe fallback.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { StaffRole } from '@/types/staff';
import type { TeacherPermissions } from '@/lib/teacherPermissions';

interface TeacherIdentityHeaderProps {
  role: StaffRole | null;
  email: string | null;
  resolved: boolean;
  permissions: TeacherPermissions;
}

export function TeacherIdentityHeader({ role, email, resolved, permissions }: TeacherIdentityHeaderProps) {
  const { t } = useLanguage();

  if (!resolved) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 animate-pulse" />
        {t('staff.teacher.identity.resolving', { defaultValue: 'Resolving authority...' })}
      </div>
    );
  }

  if (!permissions.isTeacherCapable) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <ShieldAlert className="h-4 w-4" />
        {t('staff.teacher.identity.no_access', { defaultValue: 'No teacher authority' })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {role === 'super_admin' ? (
          <Shield className="h-4 w-4 text-primary" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-primary" />
        )}
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          {role === 'super_admin'
            ? t('staff.teacher.identity.super_admin', { defaultValue: 'Super Admin' })
            : t('staff.teacher.identity.teacher', { defaultValue: 'Teacher' })
          }
        </Badge>
      </div>
      {email && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{email}</span>
      )}
      <Badge variant="secondary" className="text-xs">
        {t('staff.teacher.identity.crm_linked', { defaultValue: 'CRM Linked' })}
      </Badge>
    </div>
  );
}
