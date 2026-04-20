import { Lock, ShieldCheck } from "lucide-react";
import { AccountContentHeader } from "./AccountContentHeader";
import { AccountVerificationSteps } from "./AccountVerificationSteps";
import { useLanguage } from "@/contexts/LanguageContext";

interface DashboardOverviewProps {
  profile: {
    full_name?: string | null;
    phone?: string | null;
    avatar_storage_path?: string | null;
    email?: string | null;
  } | null;
  crmProfile?: {
    stage?: string | null;
    substage?: string | null;
    full_name?: string | null;
    phone?: string | null;
    progress?: number | null;
    email?: string | null;
    dob?: string | null;
    birth_year?: string | null;
  } | null;
  progress: number;
  docsCount: number;
  docsTotal: number;
  paymentPaid: number;
  paymentRequired: number;
  applicationsCount: number;
  shortlistCount: number;
  walletBalance: number;
  onNavigate: (tab: string) => void;
  onEditProfile?: () => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
}

export function DashboardOverview({
  profile,
  crmProfile,
  progress,
  onNavigate,
  onEditProfile,
  onAvatarUpdate,
}: DashboardOverviewProps) {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const getCurrentStep = () => {
    const substage = crmProfile?.substage?.toLowerCase() || '';
    const stage = crmProfile?.stage?.toLowerCase() || '';

    if (['submitted', 'offer_received', 'visa_approved', 'arrived'].includes(substage) ||
        stage === 'submitted' || stage === 'accepted') {
      return 3;
    }

    if (['fully_paid', 'payment_confirmed'].includes(substage) ||
        stage === 'paid' || stage === 'payment') {
      return 2;
    }

    return 1;
  };

  const fullName = crmProfile?.full_name || profile?.full_name || null;
  const email = crmProfile?.email || profile?.email || null;
  const dob = crmProfile?.dob || crmProfile?.birth_year || null;

  const notProvided = t('portal.header.notProvided');

  const fields: { key: string; label: string; value: string | null }[] = [
    { key: 'fullName', label: t('portal.header.fullName'), value: fullName },
    { key: 'dateOfBirth', label: t('portal.header.dateOfBirth'), value: dob },
    { key: 'email', label: t('portal.header.email'), value: email },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Avatar + Name */}
      <AccountContentHeader
        profile={profile}
        crmProfile={crmProfile}
        onEditProfile={onEditProfile}
        onAvatarUpdate={onAvatarUpdate}
      />

      {/* Verification Steps - directly under avatar */}
      <AccountVerificationSteps
        currentStep={getCurrentStep()}
        onVerifyClick={() => onNavigate("study-file")}
      />

      {/* Verified (read-only) account info */}
      <section
        dir={isRtl ? 'rtl' : 'ltr'}
        className="rounded-2xl border border-border bg-card p-5"
        aria-label={t('portal.header.verifiedInfo')}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {t('portal.header.verifiedInfo')}
            </h3>
          </div>
          <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          {t('portal.header.verifiedInfoHint')}
        </p>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {fields.map((f) => (
            <div
              key={f.key}
              className="rounded-xl bg-muted/40 border border-border/60 p-3"
            >
              <dt className="text-xs text-muted-foreground mb-1">{f.label}</dt>
              <dd
                className={`text-sm font-medium break-words ${
                  f.value ? 'text-foreground' : 'text-muted-foreground italic'
                }`}
              >
                {f.value || notProvided}
              </dd>
            </div>
          ))}
        </dl>
    </div>
  );
}
