import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SmartPhoneInput } from './SmartPhoneInput';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { X, Phone, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import OryxaLogo from '@/assets/oryxa-logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface PhoneActivationGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: () => void;
}

/**
 * PhoneActivationGate — forces social/email students to verify phone before activation.
 * portal_customer_map is the operational source of truth.
 * profiles.activation_status is a UI convenience cache only.
 */
export function PhoneActivationGate({ open, onOpenChange, onActivated }: PhoneActivationGateProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { startActivation, verifyActivation, isLoading } = usePortalAuth();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [error, setError] = useState('');
  const otpSubmittedRef = useRef(false);

  // Defensive runtime check: if user is already linked, never keep the gate open.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('student-portal-api', {
          body: { action: 'check_link_status' },
        });

        if (cancelled) return;

        if (!error && data?.linked === true) {
          setError('');
          setOtp('');
          setStep('phone');
          onActivated();
        }
      } catch {
        // Non-blocking: gate flow itself remains functional.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, onActivated]);

  // Auto-submit OTP on 6 digits
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !isLoading && !otpSubmittedRef.current) {
      otpSubmittedRef.current = true;
      handleVerify();
    }
    if (otp.length < 6) {
      otpSubmittedRef.current = false;
    }
  }, [otp, step, isLoading]);

  const handleSendOTP = async () => {
    setError('');
    const result = await startActivation(phone);
    if (result.ok) {
      if (result.already_activated) {
        toast({ title: t('auth.activation.alreadyActive') });
        onActivated();
        return;
      }
      setMaskedPhone(result.masked_phone || '****');
      setStep('otp');
    } else {
      setError(getActivationError(result.error_code));
    }
  };

  const handleVerify = async () => {
    setError('');
    const result = await verifyActivation(phone, otp);
    if (result.ok) {
      toast({ title: t('auth.activation.success') });
      onActivated();
    } else {
      setError(getActivationError(result.error_code));
    }
  };

  const getActivationError = (code?: string): string => {
    switch (code) {
      case 'phone_linked_to_other_account':
        return t('auth.activation.phoneLinked');
      case 'user_already_activated':
        return t('auth.activation.alreadyLinked');
      case 'invalid_code':
        return t('auth.error.invalidCode');
      case 'expired_code':
        return t('auth.error.expiredCode');
      case 'too_many_attempts':
        return t('auth.error.tooManyAttempts');
      case 'throttled':
        return t('auth.error.throttled');
      default:
        return t('auth.error.unexpected');
    }
  };

  const isPhoneValid = phone && phone.length >= 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] sm:max-w-[400px] !p-0 !gap-0 overflow-hidden !rounded-2xl !border border-border/50 shadow-2xl [&>button.absolute]:hidden !flex !flex-col bg-card"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex flex-col items-center justify-center py-4 sm:py-6 border-b border-border/30 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/20">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute left-2 top-2 sm:left-3 sm:top-3 p-1.5 rounded-full hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </button>
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">
            {t('auth.activation.title')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 px-6 text-center">
            {t('auth.activation.subtitle')}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {step === 'otp' ? (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <button
                  onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight className="w-4 h-4" />
                  {t('auth.back')}
                </button>

                <div className="text-center space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold">{t('auth.enterCode')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('auth.codeSentTo')} {maskedPhone}
                  </p>
                </div>

                <div className="flex justify-center" dir="ltr">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup className="gap-1.5 sm:gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="w-9 h-10 sm:w-11 sm:h-12 text-base sm:text-lg rounded-lg border-border bg-muted/50" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button
                  onClick={handleVerify}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      {t('auth.verifying')}
                    </>
                  ) : (
                    t('auth.activation.verify')
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="phone"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/30">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {t('auth.activation.whyPhone')}
                  </p>
                </div>

                <SmartPhoneInput
                  value={phone}
                  onChange={setPhone}
                  autoFocus
                  onSubmit={isPhoneValid ? handleSendOTP : undefined}
                />

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  onClick={handleSendOTP}
                  disabled={isLoading || !isPhoneValid}
                  className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      {t('auth.sending')}
                    </>
                  ) : (
                    t('auth.activation.sendCode')
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
