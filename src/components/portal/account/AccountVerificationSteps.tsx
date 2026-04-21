import { useEffect, useState } from "react";
import { Clock, CreditCard, ShieldCheck, ShieldAlert, ShieldQuestion, IdCard, ArrowLeftRight, Loader2, LifeBuoy, Hourglass, CheckCircle2, Wallet, Lock, HelpCircle, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { IdentityStatus } from "@/api/identitySupportInvoke";

interface AccountVerificationStepsProps {
  currentStep?: number;
  onVerifyClick?: () => void;
  onSupportClick?: () => void;
  identityStatus?: IdentityStatus;
  /** When true, the wallet has been approved/activated by staff. */
  walletApproved?: boolean;
}

const WAITLIST_STORAGE_KEY = "wallet_waitlist_joined_v1";

export function AccountVerificationSteps({
  currentStep = 1,
  onVerifyClick,
  onSupportClick,
  identityStatus = 'none',
  walletApproved = false,
}: AccountVerificationStepsProps) {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';

  const isVerified = currentStep > 1 || identityStatus === 'approved';

  // Local-only waitlist flag (per-device). Keeps UI honest without backend coupling.
  const [waitlistJoined, setWaitlistJoined] = useState<boolean>(false);
  const [joining, setJoining] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    try {
      setWaitlistJoined(window.localStorage.getItem(WAITLIST_STORAGE_KEY) === "1");
    } catch {/* ignore */}
  }, []);

  const handleJoinWaitlist = async () => {
    if (waitlistJoined || joining) return;
    setJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Best-effort log; never block the UX on this.
      if (user) {
        await supabase.from('analytics_events').insert({
          tab: 'account',
          event: 'wallet_waitlist_join',
          user_id: user.id,
          payload: { source: 'AccountVerificationSteps' } as any,
        }).then(() => {}, () => {});
      }
      window.localStorage.setItem(WAITLIST_STORAGE_KEY, "1");
      setWaitlistJoined(true);
      toast.success(t('portal.steps.walletWaitlistJoined'));
    } catch {
      window.localStorage.setItem(WAITLIST_STORAGE_KEY, "1");
      setWaitlistJoined(true);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {/* ─── Card 1: Account Verification ─────────────────────── */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[300px] flex flex-col transition-all duration-300",
          currentStep === 1
            ? "bg-warning/10 border-2 border-warning shadow-lg shadow-warning/20"
            : "bg-primary/5 border-2 border-primary/20"
        )}>
          <div className={cn("flex-1", isRtl ? "text-right" : "text-left")}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('portal.steps.verifyAccount')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('portal.steps.completeIdentity')}
            </p>

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
              <Button disabled className="w-full bg-muted text-muted-foreground font-bold text-base py-3 cursor-not-allowed">
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                {t('portal.steps.underReview')}
              </Button>
              <p className="text-xs text-muted-foreground text-center leading-relaxed px-1">
                {t('portal.steps.underReviewHint')}
              </p>
              <Button variant="outline" onClick={onSupportClick} className="w-full font-medium text-sm py-2">
                <LifeBuoy className="w-4 h-4 me-2" />
                {t('portal.steps.contactSupport')}
              </Button>
            </div>
          )}
          {currentStep === 1 && identityStatus === 'reupload_required' && (
            <Button onClick={onVerifyClick} className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-base py-3">
              {t('portal.steps.reupload')}
            </Button>
          )}
          {currentStep === 1 && (identityStatus === 'none' || identityStatus === 'rejected') && (
            <Button onClick={onVerifyClick} className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-bold text-base py-3">
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

        {/* ─── Card 2: Wallet Waitlist ──────────────────────────── */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[300px] flex flex-col transition-all duration-300 relative overflow-hidden",
          !isVerified
            ? "bg-muted/40 border border-border"
            : walletApproved
              ? "bg-primary/5 border-2 border-primary/20 opacity-80"
              : waitlistJoined
                ? "bg-warning/10 border-2 border-warning shadow-lg shadow-warning/10"
                : "bg-card border-2 border-primary/30"
        )}>
          <div className={cn("flex-1", isRtl ? "text-right" : "text-left")}>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {t('portal.steps.walletWaitlistTitle')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {waitlistJoined && !walletApproved
                ? t('portal.steps.walletWaitlistJoinedHint')
                : t('portal.steps.walletWaitlistDesc')}
            </p>

            <div className="flex justify-center my-6">
              <div className="relative">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all",
                  !isVerified
                    ? "bg-muted"
                    : walletApproved
                      ? "bg-success"
                      : waitlistJoined
                        ? "bg-warning"
                        : "bg-primary"
                )}>
                  {walletApproved ? (
                    <CheckCircle2 className="w-10 h-10 text-success-foreground" />
                  ) : waitlistJoined ? (
                    <Hourglass className="w-10 h-10 text-warning-foreground" />
                  ) : (
                    <Wallet className={cn(
                      "w-10 h-10",
                      isVerified ? "text-primary-foreground" : "text-muted-foreground"
                    )} />
                  )}
                </div>
                {!isVerified && (
                  <div className={cn(
                    "absolute -bottom-1 bg-muted rounded-lg p-1.5 shadow-md",
                    isRtl ? "-right-1" : "-left-1"
                  )}>
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isVerified ? (
            <Button disabled className="w-full bg-muted text-muted-foreground font-bold text-base py-3 cursor-not-allowed">
              <Lock className="w-4 h-4 me-2" />
              {t('portal.steps.walletLockedNeedVerify')}
            </Button>
          ) : walletApproved ? (
            <div className="flex items-center justify-center gap-2 text-success font-medium">
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('portal.steps.completed')}</span>
            </div>
          ) : waitlistJoined ? (
            <Button disabled className="w-full bg-warning/20 text-warning-foreground font-bold text-base py-3 cursor-not-allowed border border-warning/40">
              <Hourglass className="w-4 h-4 me-2" />
              {t('portal.steps.walletWaitlistJoined')}
            </Button>
          ) : (
            <Button
              onClick={handleJoinWaitlist}
              disabled={joining}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-3"
            >
              {joining ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Hourglass className="w-4 h-4 me-2" />}
              {t('portal.steps.walletJoinWaitlist')}
            </Button>
          )}
        </div>

        {/* ─── Card 3: Wallet Approved (activation confirmed) ──── */}
        <div className={cn(
          "rounded-2xl p-6 min-h-[300px] flex flex-col transition-all duration-300 relative overflow-hidden",
          walletApproved
            ? "bg-success/10 border-2 border-success shadow-lg shadow-success/20"
            : "bg-muted/40 border border-border"
        )}>
          <div className={cn("flex-1", isRtl ? "text-right" : "text-left")}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-foreground">
                {t('portal.steps.walletApprovedTitle')}
              </h3>
              {walletApproved && (
                <Badge className="bg-success/20 text-success border-success/40">
                  {t('portal.steps.walletApprovedBadge')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('portal.steps.walletApprovedDesc')}
            </p>

            <div className="flex justify-center my-6">
              <div className="relative">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all",
                  walletApproved ? "bg-success" : "bg-muted"
                )}>
                  <CreditCard className={cn(
                    "w-10 h-10",
                    walletApproved ? "text-success-foreground" : "text-muted-foreground"
                  )} />
                </div>
                {!walletApproved && (
                  <div className={cn(
                    "absolute -bottom-1 bg-muted rounded-lg p-1.5 shadow-md",
                    isRtl ? "-right-1" : "-left-1"
                  )}>
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {walletApproved ? (
            <Button className="w-full bg-success hover:bg-success/90 text-success-foreground font-bold text-base py-3">
              <ArrowLeftRight className="w-4 h-4 me-2" />
              {t('portal.steps.fundNow')}
            </Button>
          ) : (
            <Button disabled className="w-full bg-muted text-muted-foreground font-bold text-base py-3 cursor-not-allowed">
              <Hourglass className="w-4 h-4 me-2" />
              {t('portal.steps.walletWaitlistJoined')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
