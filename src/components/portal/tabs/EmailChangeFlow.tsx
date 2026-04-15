import { useState } from "react";
import { Loader2, Mail, Send, CheckCircle, RefreshCw, AlertTriangle, Pencil, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface EmailChangeFlowProps {
  initialEmail?: string;
  hasLoginCredentials?: boolean;
  onEmailChanged?: (email: string) => void;
}

type Step = 'display' | 'input' | 'otp' | 'syncing' | 'done';

export function EmailChangeFlow({
  initialEmail,
  hasLoginCredentials,
  onEmailChanged,
}: EmailChangeFlowProps) {
  const { t } = useLanguage();

  const [currentEmail] = useState(initialEmail || '');
  const [newEmail, setNewEmail] = useState('');
  const [step, setStep] = useState<Step>('display');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSendOtp = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error(t('settings.enterValidEmail'));
      return;
    }

    if (trimmed === currentEmail?.toLowerCase()) {
      toast.error(t('settings.emailSameAsCurrent'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('email-otp-send', {
        body: { email: trimmed },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to send OTP');

      setStep('otp');
      toast.success(t('settings.otpSent'));
    } catch (err: any) {
      console.error('[EmailChangeFlow] Send OTP error:', err);
      toast.error(err.message || t('settings.otpSendError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndSync = async () => {
    if (otpCode.length !== 6) {
      toast.error(t('settings.enterFullCode'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('email-otp-verify', {
        body: { code: otpCode },
      });
      if (verifyErr) throw verifyErr;
      if (!verifyData?.ok) {
        const errCode = verifyData?.error;
        if (errCode === 'invalid_or_expired_code') throw new Error(t('settings.invalidCode'));
        if (errCode === 'too_many_attempts') throw new Error(t('settings.tooManyAttempts'));
        throw new Error(t('settings.verificationFailed'));
      }

      setStep('syncing');
      const trimmedEmail = newEmail.trim().toLowerCase();
      const { data: changeData, error: changeErr } = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'change_email', new_email: trimmedEmail },
      });

      if (changeErr) throw changeErr;

      if (!changeData?.ok) {
        const code = changeData?.error;
        if (code === 'email_already_in_use') {
          setErrorMessage(t('settings.emailAlreadyInUse'));
          setStep('input');
          return;
        }
        if (code === 'profile_locked') {
          setErrorMessage(t('settings.profileLocked'));
          setStep('input');
          return;
        }
        throw new Error(changeData?.message || changeData?.error || 'CRM sync failed');
      }

      setStep('done');
      toast.success(t('settings.emailChangeSuccess'));
      onEmailChanged?.(trimmedEmail);

    } catch (err: any) {
      console.error('[EmailChangeFlow] Verify error:', err);
      toast.error(err.message);
      setStep('otp');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (step === 'done') {
    return (
      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">
              {t('settings.emailChangeSuccess')}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400" dir="ltr">{newEmail}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Display current email */}
      {step === 'display' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="font-mono text-sm text-foreground" dir="ltr">
              {currentEmail || t('settings.notSpecified')}
            </span>
            {hasLoginCredentials && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle className="h-3.5 w-3.5" />
                {t('settings.verified')}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => { setNewEmail(''); setErrorMessage(''); setStep('input'); }}
            className="gap-2"
            size="sm"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('settings.changeEmail')}
          </Button>
        </div>
      )}

      {/* Enter new email */}
      {step === 'input' && (
        <div className="space-y-3">
          {currentEmail && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>{t('settings.currentEmail')}:</span>
              <span className="font-mono" dir="ltr">{currentEmail}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              {t('settings.newEmail')}
            </label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setErrorMessage(''); }}
              placeholder="new@email.com"
              className="h-11 bg-background w-full text-base"
              dir="ltr"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.otpWillBeSentToNewEmail')}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setStep('display'); setErrorMessage(''); }}
              className="gap-2"
            >
              {t('settings.cancel')}
            </Button>
            <Button
              onClick={handleSendOtp}
              disabled={isLoading || !newEmail.trim()}
              className="gap-2 flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('settings.sendVerificationCode')}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* OTP verification */}
      {step === 'otp' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              📧 {t('settings.otpSentTo')}{' '}
              <span className="font-medium" dir="ltr">{newEmail}</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-medium text-foreground">{t('settings.enterCode')}</p>
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => { setOtpCode(''); setStep('input'); }}
                className="flex-1 gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t('settings.back')}
              </Button>
              <Button
                onClick={handleVerifyAndSync}
                disabled={isLoading || otpCode.length !== 6}
                className="flex-1 gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {t('settings.verifyAndChange')}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">{t('settings.codeExpiresIn')}</p>
          </div>
        </div>
      )}

      {/* Syncing state */}
      {step === 'syncing' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('settings.emailChangeUpdating')}</p>
        </div>
      )}
    </div>
  );
}
