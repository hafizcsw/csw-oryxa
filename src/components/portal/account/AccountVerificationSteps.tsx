import { Clock, CreditCard, ShieldCheck, ShieldAlert, ShieldQuestion, IdCard, ArrowLeftRight, Loader2, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { IdentityStatus } from "@/api/identitySupportInvoke";

interface AccountVerificationStepsProps {
  currentStep?: number;
  onVerifyClick?: () => void;
  onSupportClick?: () => void;
  identityStatus?: IdentityStatus;
}

export function AccountVerificationSteps({ 
  currentStep = 1, 
  onVerifyClick,
  onSupportClick,
  identityStatus = 'none',
}: AccountVerificationStepsProps) {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  const isVerified = currentStep > 1 || identityStatus === 'approved';

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {/* Card 1: Account Verification only */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[280px] flex flex-col transition-all duration-300",
          currentStep === 1 
            ? "bg-warning/10 border-2 border-warning shadow-lg shadow-warning/20" 
            : currentStep > 1
              ? "bg-primary/5 border-2 border-primary/20"
              : "bg-muted/50 border border-border"
        )}>
          <div className={cn("flex-1", isRtl ? "text-right" : "text-left")}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('portal.steps.verifyAccount')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('portal.steps.completeIdentity')}
            </p>
            
            {/* Verification Icon — color reflects identity status */}
            <div className="flex justify-center my-6">
              <div className="relative">
                {(() => {
                  const statusVisuals = {
                    approved: { bg: 'bg-success', fg: 'text-success-foreground', Icon: ShieldCheck },
                    pending: { bg: 'bg-warning', fg: 'text-warning-foreground', Icon: Clock },
                    reupload_required: { bg: 'bg-destructive', fg: 'text-destructive-foreground', Icon: ShieldAlert },
                    rejected: { bg: 'bg-destructive', fg: 'text-destructive-foreground', Icon: ShieldAlert },
                    none: { bg: 'bg-muted', fg: 'text-muted-foreground', Icon: ShieldQuestion },
                  } as const;
                  const v = statusVisuals[identityStatus] ?? statusVisuals.none;
                  const Icon = v.Icon;
                  return (
                    <div className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all",
                      v.bg
                    )}>
                      <Icon className={cn("w-10 h-10", v.fg)} />
                    </div>
                  );
                })()}
                {/* Small ID card icon in corner */}
                <div className={cn(
                  "absolute -bottom-1 bg-primary/10 rounded-lg p-1.5 shadow-md",
                  isRtl ? "-right-1" : "-left-1"
                )}>
                  <IdCard className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
          
          {currentStep === 1 && identityStatus === 'pending' && (
            <div className="space-y-3">
              <Button
                disabled
                className="w-full bg-muted text-muted-foreground font-bold text-base py-3 cursor-not-allowed"
              >
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                {t('portal.steps.underReview')}
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed px-1">
                {t('portal.steps.underReviewHint')}
              </p>
              <Button
                variant="outline"
                onClick={onSupportClick}
                className="w-full font-medium text-sm py-2"
              >
                <LifeBuoy className="w-4 h-4 me-2" />
                {t('portal.steps.contactSupport')}
              </Button>
            </div>
          )}
          {currentStep === 1 && identityStatus === 'reupload_required' && (
            <Button
              onClick={onVerifyClick}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-base py-3"
            >
              {t('portal.steps.reupload')}
            </Button>
          )}
          {currentStep === 1 && (identityStatus === 'none' || identityStatus === 'rejected') && (
            <Button 
              onClick={onVerifyClick}
              className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-bold text-base py-3"
            >
              {t('portal.steps.verifyNow')}
            </Button>
          )}
          {currentStep > 1 && (
            <div className="flex items-center justify-center gap-2 text-primary font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span>{t('portal.steps.completed')}</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
