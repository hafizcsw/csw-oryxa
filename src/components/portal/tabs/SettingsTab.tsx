import { useState } from "react";
import { 
  Loader2, Mail, Lock, Eye, EyeOff, CheckCircle,
  Phone, ShieldCheck, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmailChangeFlow } from "./EmailChangeFlow";
import { PhoneChangeFlow } from "./PhoneChangeFlow";

interface SettingsTabProps {
  email?: string;
  phone?: string;
  hasLoginCredentials?: boolean;
}

type PasswordChangeStep = 'form' | 'choose-method' | 'otp-verify';
type VerifyMethod = 'email' | 'whatsapp';

export function SettingsTab({ email: initialEmail, phone, hasLoginCredentials }: SettingsTabProps) {
  const { fullLogout, normalizedPhone } = useMalakChat();
  const { t, language } = useLanguage();
  
  // Email verified state
  const [emailVerified, setEmailVerified] = useState(!!hasLoginCredentials);
  const [verifiedEmail, setVerifiedEmail] = useState(initialEmail || '');
  
  // Phone state
  const [currentPhone, setCurrentPhone] = useState(phone || '');
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Password change OTP flow
  const [passwordStep, setPasswordStep] = useState<PasswordChangeStep>('form');
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>('email');
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);

  // Display phone (obscured)
  const displayPhone = currentPhone || normalizedPhone || '';
  const obscuredPhone = displayPhone 
    ? displayPhone.replace(/(\+\d{3})\d+(\d{4})/, '$1•••••$2')
    : t('settings.notSpecified');

  const handleEmailChanged = (email: string) => {
    setVerifiedEmail(email);
    setEmailVerified(true);
  };

  const handlePhoneChanged = (newPhone: string) => {
    setCurrentPhone(newPhone);
  };

  const handlePasswordFormSubmit = () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(t('settings.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    // Move to choose verification method
    setPasswordStep('choose-method');
  };

  const handleSendOtp = async (method: VerifyMethod) => {
    setVerifyMethod(method);
    setOtpSending(true);
    try {
      if (method === 'email') {
        const targetEmail = verifiedEmail || initialEmail;
        if (!targetEmail) {
          toast.error(t('settings.noEmailLinked'));
          setOtpSending(false);
          return;
        }
        // Send OTP via email using edge function
        const { error } = await supabase.functions.invoke('email-otp-send', {
          body: { email: targetEmail, purpose: 'password_change' }
        });
        if (error) throw error;
        toast.success(t('settings.otpSentToEmail'));
      } else {
        // Send OTP via WhatsApp using the phone OTP flow
        const targetPhone = displayPhone;
        if (!targetPhone) {
          toast.error(t('settings.notSpecified'));
          setOtpSending(false);
          return;
        }
        const { error } = await supabase.auth.signInWithOtp({ phone: targetPhone });
        if (error) throw error;
        toast.success(t('settings.otpSentToWhatsApp'));
      }
      setPasswordStep('otp-verify');
    } catch (error: any) {
      toast.error(error.message || t('settings.passwordUpdateError'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyAndChangePassword = async () => {
    if (otp.length < 6) {
      toast.error(t('settings.enterFullCode'));
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      if (verifyMethod === 'email') {
        // Verify email OTP
        const targetEmail = verifiedEmail || initialEmail;
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: targetEmail!,
          token: otp,
          type: 'email',
        });
        if (verifyError) throw verifyError;
      } else {
        // Verify phone OTP
        const { error: verifyError } = await supabase.auth.verifyOtp({
          phone: displayPhone,
          token: otp,
          type: 'sms',
        });
        if (verifyError) throw verifyError;
      }
      
      // OTP verified, now update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success(t('settings.passwordUpdated'));
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setPasswordStep('form');
    } catch (error: any) {
      toast.error(error.message || t('settings.passwordUpdateError'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const resetPasswordFlow = () => {
    setPasswordStep('form');
    setOtp('');
  };

  const hasEmail = !!(verifiedEmail || initialEmail);
  const hasPhone = !!displayPhone;

  return (
    <div className="space-y-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('settings.accountSettings')}</h2>
        <p className="text-muted-foreground mt-2">{t('settings.manageLoginSecurity')}</p>
      </div>

      {/* Contact Info Grid - Phone & Email */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Phone Section — verified change flow */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{t('settings.phoneNumber')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.phoneIdentityProtected')}</p>
            </div>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {t('settings.verified')}
            </span>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="font-mono text-foreground" dir="ltr">{obscuredPhone}</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('settings.phoneProtected')}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('settings.phoneChangeRequiresOtp')}</p>
            <PhoneChangeFlow 
              currentPhone={displayPhone} 
              onPhoneChanged={handlePhoneChanged} 
            />
          </div>
        </div>

        {/* Email Section */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{t('settings.emailAddress')}</h3>
              <p className="text-xs text-muted-foreground">{t('settings.forNotifications')}</p>
            </div>
            {emailVerified && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t('settings.active')}
              </span>
            )}
          </div>
          
          <EmailChangeFlow
            initialEmail={verifiedEmail || initialEmail}
            hasLoginCredentials={emailVerified}
            onEmailChanged={handleEmailChanged}
          />
        </div>
      </div>

      {/* Password Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{t('settings.password')}</h3>
            <p className="text-xs text-muted-foreground">
              {hasLoginCredentials ? t('settings.changeCurrentPassword') : t('settings.createPasswordForEmail')}
            </p>
          </div>
          {passwordStep !== 'form' && (
            <button onClick={resetPasswordFlow} className="text-xs text-primary hover:underline">
              {t('common.cancel')}
            </button>
          )}
        </div>
        
        {/* Step 1: Password form */}
        {passwordStep === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('settings.newPassword')}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.minSixChars')}
                  className="h-11 bg-background pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">{t('settings.confirmPassword')}</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.reenterPassword')}
                className="h-11 bg-background"
                dir="ltr"
              />
            </div>
            
            <Button 
              onClick={handlePasswordFormSubmit}
              disabled={!newPassword || !confirmPassword}
              className="w-full gap-2 h-11"
            >
              <Lock className="h-4 w-4" />
              {hasLoginCredentials ? t('settings.changePassword') : t('settings.createPassword')}
            </Button>
          </div>
        )}

        {/* Step 2: Choose verification method */}
        {passwordStep === 'choose-method' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <ShieldCheck className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">{t('settings.passwordChangeRequiresVerification')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('settings.chooseVerificationMethod')}</p>
            </div>
            
            <div className="grid gap-3">
              {hasEmail && (
                <Button
                  variant="outline"
                  onClick={() => handleSendOtp('email')}
                  disabled={otpSending}
                  className="w-full h-12 gap-3 justify-start"
                >
                  {otpSending && verifyMethod === 'email' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 text-primary" />
                  )}
                  {t('settings.verifyViaEmail')}
                </Button>
              )}
              {hasPhone && (
                <Button
                  variant="outline"
                  onClick={() => handleSendOtp('whatsapp')}
                  disabled={otpSending}
                  className="w-full h-12 gap-3 justify-start"
                >
                  {otpSending && verifyMethod === 'whatsapp' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  )}
                  {t('settings.verifyViaWhatsApp')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: OTP verification */}
        {passwordStep === 'otp-verify' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-sm font-medium text-foreground">{t('settings.enterOtpToChangePassword')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {verifyMethod === 'email' ? t('settings.otpSentToEmail') : t('settings.otpSentToWhatsApp')}
              </p>
            </div>
            
            <div className="flex justify-center" dir="ltr">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            
            <Button 
              onClick={handleVerifyAndChangePassword}
              disabled={isUpdatingPassword || otp.length < 6}
              className="w-full gap-2 h-11"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  {t('settings.verifyAndChange')}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
