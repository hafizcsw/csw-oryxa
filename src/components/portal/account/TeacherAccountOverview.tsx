import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, Users, CheckCircle2, 
  Clock, ArrowUpRight, FileText, Plus, Shield,
  AlertTriangle, XCircle, Loader2
} from "lucide-react";
import { AccountContentHeader } from "./AccountContentHeader";
import type { TeacherProfileState } from "@/hooks/useTeacherProfile";

interface TeacherAccountOverviewProps {
  profile: {
    full_name?: string | null;
    phone?: string | null;
    avatar_storage_path?: string | null;
  } | null;
  crmProfile?: {
    full_name?: string | null;
    phone?: string | null;
  } | null;
  teacherProfile: TeacherProfileState;
  onEditProfile?: () => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
}

export function TeacherAccountOverview({
  profile,
  crmProfile,
  teacherProfile,
  onEditProfile,
  onAvatarUpdate,
}: TeacherAccountOverviewProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

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

  const getApprovalBadge = () => {
    if (teacherProfile.loading) {
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 me-1 animate-spin" />
          {t('common.loading')}
        </Badge>
      );
    }
    if (teacherProfile.canTeach) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3 me-1" />
          {t('portal.teacherAccount.approved')}
        </Badge>
      );
    }
    if (teacherProfile.approvalStatus === 'rejected') {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 me-1" />
          {t('portal.teacherAccount.rejected')}
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

  return (
    <div className="space-y-8">
      {/* Header with Avatar + Name */}
      <AccountContentHeader
        profile={profile}
        crmProfile={crmProfile}
        onEditProfile={onEditProfile}
        onAvatarUpdate={onAvatarUpdate}
      />

      {/* Blockers Banner */}
      {teacherProfile.resolved && !teacherProfile.canTeach && teacherProfile.blockers.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-foreground">{t('portal.teacherAccount.verificationRequired')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t('portal.teacherAccount.verificationRequiredDesc')}</p>
          <div className="flex flex-wrap gap-2">
            {teacherProfile.blockers.map((blocker) => (
              <Badge key={blocker} variant="outline" className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                {t(`portal.teacherAccount.blocker.${blocker}`, { defaultValue: blocker.replace(/_/g, ' ') })}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Teacher Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Approval Status */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('portal.teacherAccount.approvalStatus')}</span>
            <Shield className="h-5 w-5 text-primary" />
          </div>
          {getApprovalBadge()}
        </div>

        {/* Identity Verification */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('portal.teacherAccount.identityVerification')}</span>
            <CheckCircle2 className={`h-5 w-5 ${teacherProfile.identityVerified ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </div>
          {teacherProfile.loading ? (
            <Badge variant="secondary"><Loader2 className="h-3 w-3 me-1 animate-spin" />{t('common.loading')}</Badge>
          ) : getStatusBadge(teacherProfile.identityVerified)}
        </div>

        {/* Education Verification */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('portal.teacherAccount.educationVerification')}</span>
            <FileText className={`h-5 w-5 ${teacherProfile.educationVerified ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </div>
          {teacherProfile.loading ? (
            <Badge variant="secondary"><Loader2 className="h-3 w-3 me-1 animate-spin" />{t('common.loading')}</Badge>
          ) : getStatusBadge(teacherProfile.educationVerified)}
        </div>
      </div>

      {/* Open Teacher Dashboard CTA */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t('portal.teacherAccount.teachingProfile')}</h3>
            <p className="text-sm text-muted-foreground">
              {teacherProfile.canTeach 
                ? t('portal.teacherAccount.teacherOverview')
                : t('portal.teacherAccount.dashboardRestricted')
              }
            </p>
          </div>
        </div>
        <Button 
          onClick={() => navigate('/staff/teacher')}
          className="gap-2"
        >
          {t('portal.teacherAccount.openDashboard')}
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions — only when teach-enabled */}
      {teacherProfile.canTeach && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('portal.teacherAccount.quickActions')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto p-4 justify-start gap-3"
              onClick={() => navigate('/staff/teacher?tab=sessions&action=create')}
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">{t('portal.teacherAccount.createSession')}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 justify-start gap-3"
              onClick={() => navigate('/staff/teacher?tab=students')}
            >
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm font-medium">{t('portal.teacherAccount.viewStudents')}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
