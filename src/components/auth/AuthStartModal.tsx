import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SmartPhoneInput } from './SmartPhoneInput';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { AccountRole } from '@/types/chat';
import { X, Phone, Mail, Eye, EyeOff, Loader2, ArrowRight, GraduationCap, Building2 } from 'lucide-react';
import OryxaLogo from '@/assets/oryxa-logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackRegisterStart, trackRegisterComplete } from '@/lib/decisionTracking';
import {
  markWelcomePending,
  isExternalUrl,
  type WelcomeTargetKind,
} from '@/lib/welcomeTransition';

type AuthMode = 'login' | 'signup';
type AuthMethod = 'phone' | 'email';
type OTPStep = 'input' | 'verify';
type AccountType = 'student' | 'institution';

interface AuthStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthStartModal({ open, onOpenChange }: AuthStartModalProps) {
  const { t, language } = useLanguage();
  
  const getErrorMessage = (result: { error?: string; error_code?: string }) => {
    switch (result.error_code) {
      case 'invalid_phone':
        return t('auth.error.invalidPhone');
      case 'customer_not_found':
        return t('auth.error.customerNotFound');
      case 'already_has_account':
        return t('auth.error.alreadyHasAccount');
      case 'invalid_code':
        return t('auth.error.invalidCode');
      case 'expired_code':
        return t('auth.error.expiredCode');
      case 'too_many_attempts':
        return t('auth.error.tooManyAttempts');
      case 'throttled':
        return result.error || t('auth.error.throttled');
      case 'server_error':
        return result.error || t('auth.error.serverError');
      default:
        return result.error || t('auth.error.unexpected');
    }
  };

  const getSupabaseErrorMessage = (error: string) => {
    if (error.includes('Invalid login credentials')) {
      return t('auth.error.invalidCredentials');
    }
    if (error.includes('Email not confirmed')) {
      return t('auth.error.emailNotConfirmed');
    }
    if (error.includes('already registered') || error.includes('User already registered')) {
      return t('auth.error.alreadyRegistered');
    }
    if (error.includes('Password should be')) {
      return t('auth.error.passwordTooShort');
    }
    if (error.includes('invalid email')) {
      return t('auth.error.invalidEmail');
    }
    return error;
  };

  // Simplified state
  const [mode, setMode] = useState<AuthMode>('login');
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [otpStep, setOtpStep] = useState<OTPStep>('input');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  
  // Form states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const otpSubmittedRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountRole] = useState<AccountRole>('student');
  const [maskedPhone, setMaskedPhone] = useState('');
  
  // UI states
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<'google' | 'apple' | null>(null);
  
  const { continueAsGuest, startLogin, verifyLogin, startSignup, verifySignup, isLoading } = usePortalAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  /**
   * Single navigation gate. Internal targets use SPA navigation (no reload,
   * no white flash). External absolute URLs still hard-redirect.
   * Always sets the welcome_pending flag so <WelcomeTransition/> takes over.
   */
  const goWithWelcome = (target: string, kind: WelcomeTargetKind, name?: string | null) => {
    markWelcomePending(name ?? null, kind);
    if (isExternalUrl(target)) {
      window.location.href = target;
      return;
    }
    navigate(target, { replace: true });
  };

  // Auto-submit OTP
  useEffect(() => {
    if (otpStep === 'verify' && otp.length === 6 && !isLoading && !otpSubmittedRef.current) {
      otpSubmittedRef.current = true;
      handleOTPVerify();
    }
    if (otp.length < 6) {
      otpSubmittedRef.current = false;
    }
  }, [otp, otpStep, isLoading]);

  const resetState = () => {
    setMode('login');
    setMethod('phone');
    setAccountType('student');
    setOtpStep('input');
    setPhone('');
    setOtp('');
    setEmail('');
    setPassword('');
    setFullName('');
    setShowPassword(false);
    setMaskedPhone('');
    setError('');
    setSuccessMessage('');
    setShowForgotPassword(false);
    setForgotEmail('');
    setIsSocialLoading(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleContinueAsGuest = async () => {
    await continueAsGuest();
    handleClose();
  };

  // ─── Social Auth Handlers ───
  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsSocialLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || t('auth.error.unexpected'));
      }
      // If redirected, the page will reload with a session
    } catch (err: any) {
      setError(err.message || t('auth.error.unexpected'));
    } finally {
      setIsSocialLoading(null);
    }
  };

  // ─── Forgot Password Handler ───
  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setError('');
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: t('auth.resetLinkSent') });
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err.message));
    } finally {
      setForgotLoading(false);
    }
  };

  // Phone auth handlers
  const handlePhoneSubmit = async () => {
    setError('');
    setSuccessMessage('');

    
    if (mode === 'login') {
      const result = await startLogin(phone);
      if (result.ok) {
        setMaskedPhone(result.masked_phone || '****');
        setSuccessMessage(t('auth.codeSent'));
        setOtpStep('verify');
      } else {
        setError(getErrorMessage(result));
      }
    } else {
      trackRegisterStart();
      const result = await startSignup(phone, accountRole);
      if (result.ok) {
        setMaskedPhone(result.masked_phone || '****');
        setSuccessMessage(t('auth.codeSent'));
        setOtpStep('verify');
      } else {
        setError(getErrorMessage(result));
      }
    }
  };

  const handleOTPVerify = async () => {
    setError('');
    
    console.log('[AuthStartModal] handleOTPVerify called', { mode, phone: phone?.slice(-4), otpLen: otp.length });
    
    if (!phone) {
      console.error('[AuthStartModal] ❌ Phone is empty at OTP verify!');
      setError('حدث خطأ، يرجى المحاولة مرة أخرى');
      return;
    }
    
    if (mode === 'login') {
      const result = await verifyLogin(phone, otp);
      console.log('[AuthStartModal] verifyLogin result:', { ok: result.ok, error: result.error, error_code: result.error_code, has_redirect: !!result.redirect_url, has_token: !!result.student_portal_token });
      if (result.ok) {
        toast({ title: t('auth.welcomeBack'), description: t('auth.loginSuccess') });
        handleClose();
        
        if (result.redirect_url) {
          console.log('[AuthStartModal] ✅ Using canonical redirect_url (magic link)');
          sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
          goWithWelcome(result.redirect_url, 'student', null);
        } else if (result.student_portal_token) {
          console.log('[AuthStartModal] ⚠️ Fallback: using student_portal_token');
          sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
          sessionStorage.setItem('portal_exchange_token', result.student_portal_token);
          goWithWelcome('/account', 'student', null);
        } else {
          console.warn('[AuthStartModal] ⚠️ No redirect_url or token, navigating to /account');
          goWithWelcome('/account', 'student', null);
        }
      } else {
        setError(getErrorMessage(result));
      }
    } else {
      const result = await verifySignup(phone, otp);
      console.log('[AuthStartModal] verifySignup result:', { ok: result.ok, error: result.error, error_code: result.error_code, has_redirect: !!result.redirect_url, has_token: !!result.student_portal_token });
      if (result.ok) {
        trackRegisterComplete();
        toast({ title: t('auth.accountCreated'), description: t('auth.welcome') });
        handleClose();
        
        if (result.redirect_url) {
          console.log('[AuthStartModal] ✅ Using canonical redirect_url (magic link)');
          sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
          goWithWelcome(result.redirect_url, 'student', null);
        } else if (result.student_portal_token) {
          console.log('[AuthStartModal] ⚠️ Fallback: using student_portal_token');
          sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
          sessionStorage.setItem('portal_exchange_token', result.student_portal_token);
          goWithWelcome('/account', 'student', null);
        } else {
          console.warn('[AuthStartModal] ⚠️ No redirect_url or token, navigating to /account');
          goWithWelcome('/account', 'student', null);
        }
      } else {
        setError(getErrorMessage(result));
      }
    }
  };

  // Email auth handlers
  const handleEmailSubmit = async () => {
    setError('');
    setIsEmailLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: t('auth.welcomeBack'), description: t('auth.loginSuccess') });
        handleClose();
        
        // Institution: resolve access and redirect to exact university page
        const userMeta = (await supabase.auth.getUser()).data.user?.user_metadata;
        const isInstitutionUser = accountType === 'institution' || userMeta?.account_type === 'institution';
        
        if (isInstitutionUser) {
          const { resolveInstitutionLanding } = await import('@/lib/resolveInstitutionLanding');
          const path = await resolveInstitutionLanding();
          goWithWelcome(path, 'institution', null);
          return;
        }
      } else {
        if (!fullName.trim()) {
          setError(t('auth.enterFullName'));
          setIsEmailLoading(false);
          return;
        }
        trackRegisterStart();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { 
              full_name: fullName,
              account_type: accountType,
            }
          }
        });
        if (error) throw error;
        trackRegisterComplete();
        
        if (accountType === 'institution') {
          toast({ 
            title: t('auth.accountCreated'), 
            description: t('auth.checkEmail')
          });
          handleClose();
          return;
        }
        
        toast({ 
          title: t('auth.accountCreated'), 
          description: t('auth.checkEmail')
        });
        handleClose();
      }
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err.message));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleBackFromOTP = () => {
    setOtpStep('input');
    setOtp('');
    setError('');
    setSuccessMessage('');
  };

  const isPhoneValid = phone && phone.length >= 5;
  const isEmailValid = email && password;
  const isSignupEmailValid = email && password && fullName.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-[95vw] sm:max-w-[400px] !p-0 !gap-0 overflow-hidden !rounded-2xl !border border-border/50 shadow-2xl [&>button.absolute]:hidden !flex !flex-col bg-card"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header with Logo */}
        <div className="flex flex-col items-center justify-center py-4 sm:py-6 border-b border-border/30 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20">
          <button
            onClick={handleClose}
            className="absolute left-2 top-2 sm:left-3 sm:top-3 p-1.5 rounded-full hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </button>
          <img 
            src={OryxaLogo} 
            alt={t('auth.logoAlt')}
            className="h-12 sm:h-16 w-auto object-contain drop-shadow-md" 
          />
          <span className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {t('auth.smartAssistant')}
          </span>
        </div>

        {/* Account Type Selector (Student / Institution) */}
        <div className="px-4 sm:px-5 pt-3 sm:pt-4">
          <div className="flex gap-1.5 sm:gap-2 p-1 bg-muted/50 rounded-xl">
            <button
              onClick={() => { setAccountType('student'); setMethod('phone'); setError(''); setShowForgotPassword(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all",
                accountType === 'student'
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('auth.accountType.student')}
            </button>
            <button
              onClick={() => { setAccountType('institution'); setMethod('email'); setError(''); setShowForgotPassword(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all",
                accountType === 'institution'
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {t('auth.accountType.institution')}
            </button>
          </div>
        </div>

        {/* Main Tabs (Login / Signup) */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => { setMode('login'); setOtpStep('input'); setError(''); setShowForgotPassword(false); }}
            className={cn(
              "flex-1 py-2.5 sm:py-3.5 text-xs sm:text-sm font-semibold transition-all relative",
              mode === 'login' 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t('auth.login')}
            {mode === 'login' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-blue-500"
              />
            )}
          </button>
          <button
            onClick={() => { setMode('signup'); setOtpStep('input'); setError(''); setShowForgotPassword(false); }}
            className={cn(
              "flex-1 py-2.5 sm:py-3.5 text-xs sm:text-sm font-semibold transition-all relative",
              mode === 'signup' 
                ? "text-indigo-600 dark:text-indigo-400" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t('auth.signup')}
            {mode === 'signup' && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-blue-500"
              />
            )}
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <AnimatePresence mode="wait">
            {/* Forgot Password Screen */}
            {showForgotPassword ? (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <button
                  onClick={() => { setShowForgotPassword(false); setError(''); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight className="w-4 h-4" />
                  {t('auth.back')}
                </button>

                <div className="text-center space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold">{t('auth.forgotPassword')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('auth.forgotPasswordDesc')}</p>
                </div>

                <Input
                  type="email"
                  placeholder={t('auth.emailAddress')}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  dir="ltr"
                  className="h-10 sm:h-12 rounded-xl bg-muted/50 border-border/50 text-left text-sm"
                  autoFocus
                />

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                <Button
                  onClick={handleForgotPassword}
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-700 hover:via-indigo-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      {t('auth.processing')}
                    </>
                  ) : (
                    t('auth.sendResetLink')
                  )}
                </Button>
              </motion.div>
            ) : otpStep === 'verify' ? (
              <motion.div
                key="otp-verify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <button
                  onClick={handleBackFromOTP}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight className="w-4 h-4" />
                  {t('auth.back')}
                </button>

                <div className="text-center space-y-1">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground">
                    {t('auth.enterCode')}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t('auth.codeSentTo')} {maskedPhone}
                  </p>
                </div>

                {successMessage && (
                  <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 text-center bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                    {successMessage}
                  </p>
                )}

                <div className="flex justify-center" dir="ltr">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                  >
                    <InputOTPGroup className="gap-1.5 sm:gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="w-9 h-10 sm:w-11 sm:h-12 text-base sm:text-lg rounded-lg border-border bg-muted/50"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button
                  onClick={handleOTPVerify}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-700 hover:via-indigo-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      {t('auth.verifying')}
                    </>
                  ) : (
                    t('auth.confirm')
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="input-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* ─── Social Login Buttons (students only) ─── */}
                {accountType === 'student' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSocialLogin('google')}
                        disabled={!!isSocialLoading}
                        className="h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-medium border-border/50 hover:bg-muted/50"
                      >
                        {isSocialLoading === 'google' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span className="truncate">Google</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSocialLogin('apple')}
                        disabled={!!isSocialLoading}
                        className="h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-medium border-border/50 hover:bg-muted/50"
                      >
                        {isSocialLoading === 'apple' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                            </svg>
                            <span className="truncate">Apple</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 text-xs text-muted-foreground bg-card">
                          {t('auth.orContinueWith')}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* Method Tabs (Phone / Email) - Phone hidden for institutions */}
                {accountType === 'student' ? (
                  <div className="flex gap-1.5 sm:gap-2 p-1 bg-muted/50 rounded-xl">
                    <button
                      onClick={() => { setMethod('phone'); setError(''); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all",
                        method === 'phone' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {t('auth.phone')}
                    </button>
                    <button
                      onClick={() => { setMethod('email'); setError(''); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all",
                        method === 'email' 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {t('auth.email')}
                    </button>
                  </div>
                ) : null}

                {/* Phone Input */}
                {method === 'phone' && (
                  <div className="space-y-3">
                    <SmartPhoneInput
                      value={phone}
                      onChange={(v) => { setPhone(v); }}
                      autoFocus
                      onSubmit={isPhoneValid ? handlePhoneSubmit : undefined}
                    />
                    
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                      onClick={handlePhoneSubmit}
                      disabled={isLoading || !isPhoneValid}
                      className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-700 hover:via-indigo-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                          {t('auth.sending')}
                        </>
                      ) : (
                        mode === 'login' ? t('auth.login') : t('auth.signup')
                      )}
                    </Button>
                  </div>
                )}

                {/* Email Input */}
                {method === 'email' && (
                  <div className="space-y-2.5 sm:space-y-3">
                    {mode === 'signup' && (
                      <Input
                        type="text"
                        placeholder={accountType === 'institution' ? t('auth.institutionName') : t('auth.fullName')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-10 sm:h-12 rounded-xl bg-muted/50 border-border/50 text-right text-sm"
                        autoFocus
                      />
                    )}
                    
                    <Input
                      type="email"
                      placeholder={t('auth.emailAddress')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      className="h-10 sm:h-12 rounded-xl bg-muted/50 border-border/50 text-left text-sm"
                      autoFocus={mode === 'login'}
                    />
                    
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('auth.password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        dir="ltr"
                        className="h-10 sm:h-12 rounded-xl bg-muted/50 border-border/50 text-left pl-10 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEmailSubmit(); } }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Forgot password link - login mode only */}
                    {mode === 'login' && (
                      <button
                        onClick={() => { setShowForgotPassword(true); setError(''); }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline w-full text-center"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    )}

                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button
                      onClick={handleEmailSubmit}
                      disabled={isEmailLoading || (mode === 'login' ? !isEmailValid : !isSignupEmailValid)}
                      className="w-full h-10 sm:h-12 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-700 hover:via-indigo-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                    >
                      {isEmailLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin ml-2" />
                          {t('auth.processing')}
                        </>
                      ) : (
                        mode === 'login' ? t('auth.login') : t('auth.signup')
                      )}
                    </Button>
                  </div>
                )}

                {/* Divider + Guest - hidden for institutions */}
                {accountType === 'student' && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 text-xs text-muted-foreground bg-card">
                          {t('common.or')}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleContinueAsGuest}
                      disabled={isLoading}
                      className="w-full h-9 sm:h-11 rounded-xl text-xs sm:text-sm font-medium border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                    >
                      {t('auth.continueAsGuest')}
                    </Button>
                  </>
                )}

                {/* Benefits */}
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/30 space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs text-center">
                  <p className="flex items-center justify-center gap-1.5 sm:gap-2 text-indigo-600 dark:text-indigo-400">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[8px] sm:text-[10px]">✓</span>
                    {accountType === 'institution' ? t('auth.institutionBenefit1') : t('auth.benefit1')}
                  </p>
                  <p className="flex items-center justify-center gap-1.5 sm:gap-2 text-indigo-600 dark:text-indigo-400">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[8px] sm:text-[10px]">✓</span>
                    {accountType === 'institution' ? t('auth.institutionBenefit2') : t('auth.benefit2')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
