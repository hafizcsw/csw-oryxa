import { AccountContentHeader } from "./AccountContentHeader";
import { AccountVerificationSteps } from "./AccountVerificationSteps";
import { TransferCountriesSection } from "./TransferCountriesSection";

interface DashboardOverviewProps {
  profile: {
    full_name?: string | null;
    phone?: string | null;
    avatar_storage_path?: string | null;
  } | null;
  crmProfile?: {
    stage?: string | null;
    substage?: string | null;
    full_name?: string | null;
    phone?: string | null;
    progress?: number | null;
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

  return (
    <div className="space-y-8">
      {/* Header with Avatar + Name */}
      <AccountContentHeader 
        profile={profile}
        crmProfile={crmProfile}
        onEditProfile={onEditProfile}
        onAvatarUpdate={onAvatarUpdate}
      />


      {/* Verification Steps */}
      <AccountVerificationSteps 
        currentStep={getCurrentStep()}
        onVerifyClick={() => onNavigate("profile")}
      />

      {/* Transfer Countries Section */}
      <TransferCountriesSection />
    </div>
  );
}
