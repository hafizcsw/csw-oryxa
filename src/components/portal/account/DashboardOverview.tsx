import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { AccountContentHeader } from "./AccountContentHeader";
import { AccountVerificationSteps } from "./AccountVerificationSteps";
import { IdentityActivationDialog } from "../identity/IdentityActivationDialog";
import { SupportSection } from "../support/SupportSection";
import { SupportSubmitDialog } from "../support/SupportSubmitDialog";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useExtractedIdentity } from "@/hooks/useExtractedIdentity";
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
  const [identityOpen, setIdentityOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { status: identityStatus } = useIdentityStatus();
  const { fields: extracted } = useExtractedIdentity();

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

  // Verified-info fields. Source priority: extracted (live from reader) > CRM > local profile.
  // Date-of-birth is normalised to a locale-friendly string when possible.
  const formatDate = (raw?: string | null) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
    } catch {
      return raw;
    }
  };
  const titleCase = (s?: string | null) => {
    if (!s) return null;
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  };

  const fullName = extracted.full_name || crmProfile?.full_name || profile?.full_name || null;
  const email = crmProfile?.email || profile?.email || null;
  const dob = formatDate(extracted.date_of_birth) || crmProfile?.dob || crmProfile?.birth_year || null;
  const nationality = titleCase(extracted.nationality);
  const documentNumber = extracted.document_number || null;
  const issuingCountry = titleCase(extracted.issuing_country);
  const expiryDate = formatDate(extracted.expiry_date);

  const notProvided = t('portal.header.notProvided');

  const baseFields: { key: string; label: string; value: string | null }[] = [
    { key: 'fullName', label: t('portal.header.fullName'), value: fullName },
    { key: 'dateOfBirth', label: t('portal.header.dateOfBirth'), value: dob },
    { key: 'email', label: t('portal.header.email'), value: email },
  ];

  // Show document-derived fields only once we actually have a reader output
  // (live or post-approval). Otherwise the card stays as-is.
  const hasExtracted = !!(nationality || documentNumber || issuingCountry || expiryDate);
  const extraFields: { key: string; label: string; value: string | null }[] = hasExtracted
    ? [
        { key: 'nationality', label: t('portal.identity.summary.field.nationality', { defaultValue: 'الجنسية' }), value: nationality },
        { key: 'documentNumber', label: t(`portal.identity.summary.field.document_number.${extracted.document_number ? 'passport' : 'passport'}`, { defaultValue: 'رقم الوثيقة' }), value: documentNumber },
        { key: 'issuingCountry', label: t('portal.identity.summary.field.issuing_country', { defaultValue: 'بلد الإصدار' }), value: issuingCountry },
        { key: 'expiryDate', label: t('portal.identity.summary.field.expiry_date', { defaultValue: 'تاريخ الانتهاء' }), value: expiryDate },
      ].filter((f) => f.value)
    : [];

  const fields = [...baseFields, ...extraFields];

  // Build a short "First Last" display name from the verified extracted full name.
  // Falls back to whatever fullName resolves to if extraction is incomplete.
  const buildShortName = (raw?: string | null): string | null => {
    if (!raw) return null;
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const last = parts[parts.length - 1];
    const cased = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return `${cased(first)} ${cased(last)}`;
  };
  const verifiedShortName = buildShortName(extracted.full_name) || buildShortName(fullName);

  return (
    <div className="space-y-8">
      {/* Header with Avatar + Name */}
      <AccountContentHeader
        profile={profile}
        crmProfile={crmProfile}
        canonicalIdentity={verifiedShortName ? { full_name: verifiedShortName } : null}
        onEditProfile={onEditProfile}
        onAvatarUpdate={onAvatarUpdate}
      />

      {/* Verification Steps - directly under avatar */}
      <AccountVerificationSteps
        currentStep={identityStatus.identity_status === 'approved' ? 2 : getCurrentStep()}
        identityStatus={identityStatus.identity_status}
        onVerifyClick={() => setIdentityOpen(true)}
        onSupportClick={() => setSupportOpen(true)}
      />

      {/* Identity Activation Dialog */}
      <IdentityActivationDialog
        open={identityOpen}
        onOpenChange={setIdentityOpen}
        onApproved={() => onNavigate('study-file')}
      />

      {/* Support Submit Dialog (opened from under-review state) */}
      <SupportSubmitDialog open={supportOpen} onOpenChange={setSupportOpen} />

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
      </section>

      {/* Website Support */}
      <SupportSection />
    </div>
  );
}
