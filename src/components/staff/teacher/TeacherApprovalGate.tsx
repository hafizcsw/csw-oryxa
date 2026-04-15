/**
 * TeacherApprovalGate — Shows restricted state when teacher is not teach-eligible.
 * Teacher can still see the dashboard shell but teaching actions are blocked.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, CheckCircle2, Clock, Shield, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TeacherApprovalState } from '@/hooks/useTeacherApproval';

interface TeacherApprovalGateProps {
  approval: TeacherApprovalState;
}

export function TeacherApprovalGate({ approval }: TeacherApprovalGateProps) {
  const { t } = useLanguage();

  if (approval.loading || !approval.resolved) return null;
  if (approval.canTeach) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">
            {t('staff.teacher.approval.restricted_title', { defaultValue: 'Teaching Actions Restricted' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('staff.teacher.approval.restricted_desc', { defaultValue: 'Complete the required verification steps to unlock full teaching capabilities.' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Identity */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Shield className={`h-4 w-4 ${approval.identityVerified ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-sm">{t('portal.teacherAccount.identityVerification', { defaultValue: 'Identity' })}</span>
          {approval.identityVerified ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 ms-auto" />
          ) : (
            <Clock className="h-4 w-4 text-amber-500 ms-auto" />
          )}
        </div>

        {/* Education */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <FileText className={`h-4 w-4 ${approval.educationVerified ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-sm">{t('portal.teacherAccount.educationVerification', { defaultValue: 'Education' })}</span>
          {approval.educationVerified ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 ms-auto" />
          ) : (
            <Clock className="h-4 w-4 text-amber-500 ms-auto" />
          )}
        </div>

        {/* Approval */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Shield className={`h-4 w-4 ${approval.canTeach ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span className="text-sm">{t('portal.teacherAccount.approvalStatus', { defaultValue: 'Approval' })}</span>
          {approval.canTeach ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 ms-auto" />
          ) : (
            <Clock className="h-4 w-4 text-amber-500 ms-auto" />
          )}
        </div>
      </div>

      {approval.blockers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {approval.blockers.map((blocker) => (
            <Badge key={blocker} variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
              {t(`portal.teacherAccount.blocker.${blocker}`, { defaultValue: blocker.replace(/_/g, ' ') })}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
