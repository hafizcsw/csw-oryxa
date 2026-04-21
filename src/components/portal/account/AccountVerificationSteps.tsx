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
            <p className="text-sm text-muted-foreground mb-3">
              {t('portal.steps.completeIdentity')}
            </p>

            <div className={cn("mb-4", isRtl ? "text-right" : "text-left")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWhyOpen(true)}
                className="h-auto px-2 py-1 text-xs text-primary hover:text-primary hover:bg-primary/5 gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {t('portal.steps.whyVerifyButton')}
              </Button>
            </div>

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

      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <DialogContent
          dir={isRtl ? "rtl" : "ltr"}
          className="sm:max-w-[560px] w-[calc(100vw-2rem)] p-0 gap-0 border-border/60 overflow-hidden [&>button]:top-3 [&>button]:end-3 [&>button]:start-auto"
        >
          <div className="flex flex-col w-full">
            {/* Hero header */}
            <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-7 pb-6 border-b border-border/40 w-full">
              <div className="flex items-start gap-4 w-full">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogHeader className="space-y-1.5 text-start">
                    <DialogTitle className="text-xl font-bold tracking-tight text-foreground text-start">
                      {t('portal.steps.whyVerifyTitle')}
                    </DialogTitle>
                    <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground text-start">
                      {t('portal.steps.whyVerifyIntro')}
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>
            </div>

            {/* Benefits list */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto w-full">
              <ul className="space-y-2.5 w-full">
                {[
                  { Icon: ShieldCheck, title: 'portal.steps.whyVerifyPoint1Title', body: 'portal.steps.whyVerifyPoint1Body', tone: 'success' },
                  { Icon: GraduationCap, title: 'portal.steps.whyVerifyPoint2Title', body: 'portal.steps.whyVerifyPoint2Body', tone: 'primary' },
                  { Icon: Users, title: 'portal.steps.whyVerifyPoint3Title', body: 'portal.steps.whyVerifyPoint3Body', tone: 'warning' },
                ].map(({ Icon, title, body, tone }) => (
                  <li
                    key={title}
                    className="group w-full rounded-xl p-3.5 border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-200 flex gap-3.5 items-start"
                  >
                    <div
                      className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1 transition-transform group-hover:scale-105",
                        tone === 'success' && "bg-success/10 ring-success/20 text-success",
                        tone === 'primary' && "bg-primary/10 ring-primary/20 text-primary",
                        tone === 'warning' && "bg-warning/10 ring-warning/30 text-warning",
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <h4 className="text-sm font-semibold text-foreground mb-1 leading-snug">{t(title)}</h4>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{t(body)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20 sm:justify-end w-full">
              <Button
                onClick={() => setWhyOpen(false)}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 me-2" />
                {t('portal.steps.whyVerifyClose')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
