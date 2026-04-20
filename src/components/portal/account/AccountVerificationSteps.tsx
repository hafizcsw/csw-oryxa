import { Clock, CreditCard, ShieldCheck, IdCard, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface AccountVerificationStepsProps {
  currentStep?: number;
  onVerifyClick?: () => void;
}

export function AccountVerificationSteps({ 
  currentStep = 1, 
  onVerifyClick 
}: AccountVerificationStepsProps) {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
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
            
            {/* Verification Icon */}
            <div className="flex justify-center my-6">
              <div className="relative">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all",
                  currentStep >= 1 ? "bg-success" : "bg-muted"
                )}>
                  <ShieldCheck className={cn(
                    "w-10 h-10",
                    currentStep >= 1 ? "text-success-foreground" : "text-muted-foreground"
                  )} />
                </div>
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
          
          {currentStep === 1 && (
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

        {/* Card 2: Deposit Wallet */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[280px] flex flex-col transition-all duration-300",
          currentStep === 2 
            ? "bg-warning/10 border-2 border-warning shadow-lg" 
            : currentStep > 2
              ? "bg-primary/5 border-2 border-primary/20"
              : "bg-muted/50 border border-border"
        )}>
          <div className={cn(isRtl ? "text-right" : "text-left")}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('portal.steps.fundWallet')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('portal.steps.addBalance')}
            </p>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all",
              currentStep >= 2 ? "bg-primary/10" : "bg-muted"
            )}>
              <CreditCard className={cn(
                "w-8 h-8",
                currentStep >= 2 ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            {currentStep < 2 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{t('portal.steps.pending')}</span>
              </div>
            )}
            {currentStep === 2 && (
              <Button 
                className="mt-4 bg-warning hover:bg-warning/90 text-warning-foreground font-bold"
              >
                {t('portal.steps.fundNow')}
              </Button>
            )}
            {currentStep > 2 && (
              <div className="flex items-center gap-2 text-primary font-medium">
                <ShieldCheck className="w-5 h-5" />
                <span>{t('portal.steps.completed')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Money Transfer */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[280px] flex flex-col transition-all duration-300",
          currentStep === 3 
            ? "bg-warning/10 border-2 border-warning shadow-lg" 
            : currentStep > 3
              ? "bg-primary/5 border-2 border-primary/20"
              : "bg-muted/50 border border-border"
        )}>
          <div className={cn(isRtl ? "text-right" : "text-left")}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('portal.steps.transferMoney')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('portal.steps.sendReceive')}
            </p>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all",
              currentStep >= 3 ? "bg-primary/10" : "bg-muted"
            )}>
              <ArrowLeftRight className={cn(
                "w-8 h-8",
                currentStep >= 3 ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            {currentStep < 3 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{t('portal.steps.pending')}</span>
              </div>
            )}
            {currentStep === 3 && (
              <Button 
                className="mt-4 bg-warning hover:bg-warning/90 text-warning-foreground font-bold"
              >
                {t('portal.steps.transferNow')}
              </Button>
            )}
            {currentStep > 3 && (
              <div className="flex items-center gap-2 text-primary font-medium">
                <ShieldCheck className="w-5 h-5" />
                <span>{t('portal.steps.completed')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
