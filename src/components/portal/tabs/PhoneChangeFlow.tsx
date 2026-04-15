import { useState } from "react";
import { Loader2, Phone, Send, CheckCircle, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PhoneChangeFlowProps {
  currentPhone?: string;
  onPhoneChanged?: (newPhone: string) => void;
}

type Step = 'idle' | 'enter_phone' | 'otp_sent' | 'verifying_crm' | 'success' | 'error';

export function PhoneChangeFlow({ currentPhone, onPhoneChanged }: PhoneChangeFlowProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const resetFlow = () => {
    setStep('idle');
    setNewPhone('');
    setOtpCode('');
    setErrorMessage('');
    setIsLoading(false);
  };

  const handleOpen = () => {
    resetFlow();
    setStep('enter_phone');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetFlow();
  };

  const handleSendOtp = async () => {
    const phone = newPhone.trim();
    if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
      toast.error(t('settings.phoneChangeEnterValid'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      // Use Supabase phone OTP to verify the new number
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;

      setStep('otp_sent');
      toast.success(t('settings.phoneChangeOtpSent'));
    } catch (err: any) {
      console.error('[PhoneChangeFlow] Send OTP error:', err);
      toast.error(err.message || t('settings.phoneChangeOtpError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndChange = async () => {
    if (otpCode.length !== 6) {
      toast.error(t('settings.enterFullCode'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      // 1) Verify OTP with Supabase
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        phone: newPhone.trim(),
        token: otpCode,
        type: 'sms',
      });
      if (verifyErr) {
        if (verifyErr.message.includes('expired') || verifyErr.message.includes('invalid')) {
          toast.error(t('settings.invalidCode'));
        } else {
          toast.error(verifyErr.message);
        }
        return;
      }

      // 2) OTP verified — now call CRM contract via Portal API
      setStep('verifying_crm');
      const { data, error: invokeErr } = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'change_phone', new_phone_e164: newPhone.trim() },
      });

      if (invokeErr) throw invokeErr;

      if (!data?.ok) {
        const errCode = data?.error;
        if (errCode === 'phone_already_in_use') {
          setErrorMessage(t('settings.phoneAlreadyInUse'));
          setStep('error');
          return;
        }
        if (errCode === 'profile_locked') {
          setErrorMessage(t('settings.profileLocked'));
          setStep('error');
          return;
        }
        throw new Error(data?.message || data?.error || 'Unknown error');
      }

      // 3) Success
      setStep('success');
      toast.success(t('settings.phoneChangeSuccess'));
      onPhoneChanged?.(newPhone.trim());

    } catch (err: any) {
      console.error('[PhoneChangeFlow] Verify error:', err);
      setErrorMessage(err.message || t('settings.phoneChangeError'));
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5 text-xs"
      >
        <Phone className="h-3.5 w-3.5" />
        {t('settings.phoneChangeButton')}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t('settings.phoneChangeTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.phoneChangeDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {step === 'enter_phone' && (
              <div className="space-y-4">
                {currentPhone && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <span className="text-muted-foreground">{t('settings.phoneChangeCurrent')}: </span>
                    <span className="font-mono" dir="ltr">{currentPhone}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+966512345678"
                    className="h-11 bg-background text-base font-mono"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.phoneChangeE164Hint')}</p>
                </div>
                <Button
                  onClick={handleSendOtp}
                  disabled={isLoading || !newPhone.trim()}
                  className="w-full gap-2 h-11"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {t('settings.phoneChangeSendOtp')}
                    </>
                  )}
                </Button>
              </div>
            )}

            {step === 'otp_sent' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    📱 {t('settings.phoneChangeOtpSentTo')}{' '}
                    <span className="font-mono font-medium" dir="ltr">{newPhone}</span>
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-medium text-foreground">
                    {t('settings.enterCode')}
                  </p>
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
                      onClick={() => { setOtpCode(''); setStep('enter_phone'); }}
                      className="flex-1 gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('settings.resendCode')}
                    </Button>
                    <Button
                      onClick={handleVerifyAndChange}
                      disabled={isLoading || otpCode.length !== 6}
                      className="flex-1 gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {t('settings.verifyCode')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 'verifying_crm' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('settings.phoneChangeUpdating')}</p>
              </div>
            )}

            {step === 'success' && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      {t('settings.phoneChangeSuccess')}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-mono" dir="ltr">
                      {newPhone}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={handleClose}>
                  {t('settings.close')}
                </Button>
              </div>
            )}

            {step === 'error' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose} className="flex-1">
                    {t('settings.close')}
                  </Button>
                  <Button onClick={() => { resetFlow(); setStep('enter_phone'); }} className="flex-1">
                    {t('settings.tryAgain')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
