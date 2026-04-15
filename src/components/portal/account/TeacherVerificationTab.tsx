/**
 * TeacherVerificationTab — Teacher verification center inside /account.
 * Consumes canonical teacher profile from useTeacherProfile.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, ShieldCheck, CheckCircle2, Clock, XCircle, 
  AlertTriangle, Upload, ArrowUpRight, Loader2,
  Mail, Phone, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TeacherProfileState } from '@/hooks/useTeacherProfile';

interface TeacherVerificationTabProps {
  profile: TeacherProfileState;
}

export function TeacherVerificationTab({ profile }: TeacherVerificationTabProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const getVerificationIcon = (verified: boolean) => {
    if (verified) return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    return <Clock className="h-5 w-5 text-amber-500" />;
  };

  const getStatusBadge = (verified: boolean) => {
    if (verified) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3 me-1" />
          {t('portal.teacherAccount.verified')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        <Clock className="h-3 w-3 me-1" />
        {t('portal.teacherAccount.pending')}
      </Badge>
    );
  };

  if (profile.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Title */}
      <div>
        <h2 className="text-xl font-bold text-foreground">
          {t('portal.teacherAccount.verificationCenter')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('portal.teacherAccount.verificationCenterDesc')}
        </p>
      </div>

      {/* Overall Status Banner */}
      {profile.canTeach ? (
        <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-semibold text-foreground">{t('portal.teacherAccount.fullyVerified')}</h3>
              <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.fullyVerifiedDesc')}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-foreground">{t('portal.teacherAccount.verificationRequired')}</h3>
              <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.verificationRequiredDesc')}</p>
            </div>
          </div>
          {profile.blockers.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {profile.blockers.map((blocker) => (
                <Badge key={blocker} variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                  {t(`portal.teacherAccount.blocker.${blocker}`, { defaultValue: blocker.replace(/_/g, ' ') })}
                </Badge>
              ))}
            </div>
          )}
          {/* Reviewer notes / rejection reason */}
          {(profile.rejectionReason || profile.reviewerNotes || profile.moreInfoReason) && (
            <div className="rounded-lg bg-card border border-border p-3 mt-2 space-y-1">
              {profile.rejectionReason && (
                <p className="text-sm text-destructive">
                  <XCircle className="h-3.5 w-3.5 inline me-1" />
                  {profile.rejectionReason}
                </p>
              )}
              {profile.reviewerNotes && (
                <p className="text-sm text-muted-foreground">{profile.reviewerNotes}</p>
              )}
              {profile.moreInfoReason && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{profile.moreInfoReason}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Verification Checklist */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('portal.teacherAccount.verificationChecklist')}
        </h3>

        <div className="space-y-3">
          {/* Identity Verification */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getVerificationIcon(profile.identityVerified)}
                <div>
                  <p className="font-medium text-foreground">{t('portal.teacherAccount.identityVerification')}</p>
                  <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.identityVerificationDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(profile.identityVerified)}
                {!profile.identityVerified && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/account?tab=teacher-documents')}>
                    <Upload className="h-3.5 w-3.5 me-1.5" />
                    {t('portal.teacherAccount.uploadNow')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Education Verification */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getVerificationIcon(profile.educationVerified)}
                <div>
                  <p className="font-medium text-foreground">{t('portal.teacherAccount.educationVerification')}</p>
                  <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.educationVerificationDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(profile.educationVerified)}
                {!profile.educationVerified && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/account?tab=teacher-documents')}>
                    <Upload className="h-3.5 w-3.5 me-1.5" />
                    {t('portal.teacherAccount.uploadNow')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Approval Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className={`h-5 w-5 ${profile.canTeach ? 'text-emerald-500' : 'text-amber-500'}`} />
                <div>
                  <p className="font-medium text-foreground">{t('portal.teacherAccount.approvalStatus')}</p>
                  <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.approvalStatusDesc')}</p>
                </div>
              </div>
              {profile.canTeach ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  {t('portal.teacherAccount.approved')}
                </Badge>
              ) : profile.approvalStatus === 'rejected' ? (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="h-3 w-3 me-1" />
                  {t('portal.teacherAccount.rejected')}
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                  <Clock className="h-3 w-3 me-1" />
                  {t('portal.teacherAccount.pending')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CRM Contact Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('portal.teacherAccount.linkedContact')}
        </h3>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('portal.teacherAccount.emailLinked')}</p>
              <p className="text-sm font-medium text-foreground">{profile.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('portal.teacherAccount.phoneLinked')}</p>
              <p className="text-sm font-medium text-foreground">{profile.phone || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh + Dashboard shortcut */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={profile.refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('portal.teacherAccount.refreshStatus')}
        </Button>
        <Button onClick={() => navigate('/staff/teacher')} className="gap-2">
          {t('portal.teacherAccount.openDashboard')}
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
