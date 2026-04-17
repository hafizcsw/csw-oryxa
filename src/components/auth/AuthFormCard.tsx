import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SmartPhoneInput } from './SmartPhoneInput';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { AccountRole } from '@/types/chat';
import { Phone, Eye, EyeOff, Loader2, ArrowRight, GraduationCap, Building2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackRegisterStart, trackRegisterComplete } from '@/lib/decisionTracking';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { WelcomeOverlay } from './WelcomeOverlay';

/** Check persistent staff cache for instant post-login redirect */
function getStaffFastRedirect(): string | null {
  try {
    const raw = localStorage.getItem('staff_authority_persistent_v3');
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.role || cached.accessScope === 'crm_only') return null;
    const map: Record<string, string> = {
      teacher: '/staff/teacher',
      editor: '/staff/editor',
      content_staff: '/staff/content',
    };
    return map[cached.role] || null;
  } catch {
    return null;
  }
}

type AuthMode = 'login' | 'signup';

type OTPStep = 'input' | 'verify';
type EmailSignupStep = 'form' | 'email_verify';
type AccountType = 'student' | 'institution';

interface AuthFormCardProps {
  defaultMode?: AuthMode;
  defaultAccountType?: AccountType;
  onSuccess?: () => void;
  onAccountTypeChange?: (type: AccountType) => void;
}

export function AuthFormCard({ defaultMode = 'login', defaultAccountType = 'student', onSuccess, onAccountTypeChange }: AuthFormCardProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const getErrorMessage = (result: { error?: string; error_code?: string }) => {
    switch (result.error_code) {
      case 'invalid_phone': return t('auth.error.invalidPhone');
      case 'customer_not_found': return t('auth.error.customerNotFound');
      case 'already_has_account': return t('auth.error.alreadyHasAccount');
      case 'invalid_code': return t('auth.error.invalidCode');
      case 'expired_code': return t('auth.error.expiredCode');
      case 'too_many_attempts': return t('auth.error.tooManyAttempts');
      case 'throttled': return result.error || t('auth.error.throttled');
      case 'server_error': return result.error || t('auth.error.serverError');
      default: return result.error || t('auth.error.unexpected');
    }
  };

  const getSupabaseErrorMessage = (error: string) => {
    if (error.includes('Invalid login credentials')) return t('auth.error.invalidCredentials');
    if (error.includes('Email not confirmed')) return t('auth.error.emailNotConfirmed');
    if (error.includes('already registered') || error.includes('User already registered')) return t('auth.error.alreadyRegistered');
    if (error.includes('Password should be')) return t('auth.error.passwordTooShort');
    if (error.includes('invalid email')) return t('auth.error.invalidEmail');
    return error;
  };

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  
  const [accountType, setAccountTypeState] = useState<AccountType>(defaultAccountType);
  const setAccountType = (type: AccountType) => {
    setAccountTypeState(type);
    onAccountTypeChange?.(type);
  };
  const [otpStep, setOtpStep] = useState<OTPStep>('input');
  const [emailSignupStep, setEmailSignupStep] = useState<EmailSignupStep>('form');
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailOtpLoading, setIsEmailOtpLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const otpSubmittedRef = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountRole] = useState<AccountRole>('student');
  const [maskedPhone, setMaskedPhone] = useState('');

  const [error, setError] = useState('');
  
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<'google' | 'apple' | null>(null);

  // Fullscreen welcome overlay shown during the post-login redirect
  // (replaces the blank white "flash" caused by window.location.href).
  const [redirecting, setRedirecting] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  const beginRedirect = (name?: string | null) => {
    setWelcomeName(name ?? null);
    setRedirecting(true);
  };

  const { continueAsGuest, startLogin, verifyLogin, startSignup, verifySignup, isLoading } = usePortalAuth();

  // Auto-submit phone OTP
  useEffect(() => {
    if (otpStep === 'verify' && otp.length === 6 && !isLoading && !otpSubmittedRef.current) {
      otpSubmittedRef.current = true;
      handleOTPVerify();
    }
    if (otp.length < 6) otpSubmittedRef.current = false;
  }, [otp, otpStep, isLoading]);

  // Auto-submit email OTP
  const emailOtpSubmittedRef = useRef(false);
  useEffect(() => {
    if (emailSignupStep === 'email_verify' && emailOtp.length === 6 && !isEmailOtpLoading && !emailOtpSubmittedRef.current) {
      emailOtpSubmittedRef.current = true;
      handleEmailOtpVerify();
    }
    if (emailOtp.length < 6) emailOtpSubmittedRef.current = false;
  }, [emailOtp, emailSignupStep, isEmailOtpLoading]);

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError('');
    setIsSocialLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) setError(result.error.message || t('auth.error.unexpected'));
    } catch (err: any) {
      setError(err.message || t('auth.error.unexpected'));
    } finally {
      setIsSocialLoading(null);
    }
  };

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

  const handlePhoneSubmit = async () => {
    setError('');
    
    if (mode === 'login') {
      const result = await startLogin(phone);
      if (result.ok) {
        setMaskedPhone(result.masked_phone || '****');
        setOtpStep('verify');
      } else {
        setError(getErrorMessage(result));
      }
    } else {
      trackRegisterStart();
      const result = await startSignup(phone, accountRole);
      if (result.ok) {
        setMaskedPhone(result.masked_phone || '****');
        setOtpStep('verify');
      } else {
        setError(getErrorMessage(result));
      }
    }
  };

  const handleOTPVerify = async () => {
    setError('');
    if (!phone) { setError(t('auth.error.unexpected')); return; }
    
    const verifyFn = mode === 'login' ? verifyLogin : verifySignup;
    const result = await verifyFn(phone, otp);
    
    if (result.ok) {
      if (mode !== 'login') trackRegisterComplete();
      toast({ 
        title: mode === 'login' ? t('auth.welcomeBack') : t('auth.accountCreated'), 
        description: mode === 'login' ? t('auth.loginSuccess') : t('auth.welcome') 
      });
      
      if (result.redirect_url) {
        sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
        window.location.href = result.redirect_url;
      } else if (result.student_portal_token) {
        sessionStorage.setItem('portal_auth_pending_until', String(Date.now() + 15000));
        sessionStorage.setItem('portal_exchange_token', result.student_portal_token);
        window.location.href = '/account';
      } else {
        window.location.href = '/account';
      }
      onSuccess?.();
    } else {
      setError(getErrorMessage(result));
    }
  };

  const handleEmailSubmit = async () => {
    setError('');
    setIsEmailLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: t('auth.welcomeBack'), description: t('auth.loginSuccess') });
        
        // Check if this user is an institution operator (from metadata OR selected tab)
        const userMeta = (await supabase.auth.getUser()).data.user?.user_metadata;
        const isInstitutionUser = accountType === 'institution' || userMeta?.account_type === 'institution';
        
        if (isInstitutionUser) {
          const { resolveInstitutionLanding } = await import('@/lib/resolveInstitutionLanding');
          window.location.href = await resolveInstitutionLanding();
          return;
        }
        
        // ⚡ Fast-path: check persistent staff cache for instant redirect
        const staffRedirect = getStaffFastRedirect();
        if (staffRedirect) {
          sessionStorage.setItem('staff_routed_once', '1');
          window.location.href = staffRedirect;
        } else {
          // No cache — try CRM resolution before defaulting to home
          try {
            const { data: staffResult } = await supabase.functions.invoke('student-portal-api', {
              body: { action: 'resolve_staff_authority' },
            });
            if (staffResult?.data?.is_staff && staffResult?.data?.role && staffResult?.data?.access_scope !== 'crm_only') {
              const role = staffResult.data.role;
              const landingMap: Record<string, string> = {
                teacher: '/staff/teacher',
                editor: '/staff/editor',
                content_staff: '/staff/content',
              };
              const path = landingMap[role];
              if (path) {
                sessionStorage.setItem('staff_routed_once', '1');
                window.location.href = path;
                return;
              }
            }
          } catch {}
          onSuccess?.();
          window.location.href = '/';
        }
      } else {
        if (!fullName.trim()) { setError(t('auth.enterFullName')); setIsEmailLoading(false); return; }
        trackRegisterStart();
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, account_type: accountType }
          }
        });
        if (error) throw error;
        
        // Check if email confirmation is required (user not auto-confirmed)
        if (data?.user && !data.user.email_confirmed_at) {
          // User created but needs email verification
          setEmailSignupStep('email_verify');
          toast({ title: t('auth.checkEmail'), description: t('auth.verificationCodeSent') });
        } else {
          // Auto-confirmed (shouldn't happen with our config, but fallback)
          trackRegisterComplete();
          toast({ title: t('auth.accountCreated'), description: t('auth.welcome') });
          onSuccess?.();
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err.message));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailOtpVerify = async () => {
    if (!email || !emailOtp.trim()) return;
    setIsEmailOtpLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: emailOtp.trim(),
        type: 'signup',
      });
      if (error) throw error;
      trackRegisterComplete();
      toast({ title: t('auth.accountCreated'), description: t('auth.welcome') });
      onSuccess?.();
      window.location.href = '/';
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err.message));
    } finally {
      setIsEmailOtpLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setError('');
    setIsEmailLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/` }
      });
      if (error) throw error;
      toast({ title: t('auth.codeSentAgain') });
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err.message));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    await continueAsGuest();
    onSuccess?.();
    window.location.href = '/';
  };

  const isPhoneValid = phone && phone.length >= 5;
  const isEmailValid = email && password;
  const isSignupEmailValid = email && password && fullName.trim();

  // ── Shared button style
  const primaryBtnCls = "w-full h-12 rounded-xl font-bold bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-md shadow-primary/15 hover:-translate-y-0.5 active:scale-[0.98] transition-all tracking-wide";

  return (
    <div className="w-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── 1. Account type toggle ────────────────────────── */}
      <div className="mb-5">
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/30">
          <button
            onClick={() => { setAccountType('student'); setError(''); setShowForgotPassword(false); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
              accountType === 'student'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GraduationCap className="w-4 h-4" />
            {t('auth.accountType.student')}
          </button>
          <button
            onClick={() => { setAccountType('institution'); setError(''); setShowForgotPassword(false); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
              accountType === 'institution'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="w-4 h-4" />
            {t('auth.accountType.institution')}
          </button>
        </div>
      </div>

      {/* ── 2. Login / Signup tabs ────────────────────────── */}
      <div className="flex mb-5 border-b border-border/30">
        {(['login', 'signup'] as AuthMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setOtpStep('input'); setError(''); setShowForgotPassword(false); }}
            className={cn(
              "flex-1 pb-3 text-sm font-semibold transition-all relative",
              mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(m === 'login' ? 'auth.login' : 'auth.signup')}
            {mode === m && (
              <motion.div
                layoutId="authTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* ── 3. Form content ───────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ─── Forgot password ──── */}
        {showForgotPassword ? (
          <motion.div key="forgot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <button onClick={() => { setShowForgotPassword(false); setError(''); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-4 h-4" />
              {t('auth.back')}
            </button>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">{t('auth.forgotPassword')}</h3>
              <p className="text-sm text-muted-foreground">{t('auth.forgotPasswordDesc')}</p>
            </div>
            <Input type="email" placeholder={t('auth.emailAddress')} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} dir="ltr" className="h-12 rounded-xl bg-muted/30 border-border/40 text-left" autoFocus />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail} className={primaryBtnCls}>
              {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{t('auth.processing')}</> : t('auth.sendResetLink')}
            </Button>
          </motion.div>

        /* ─── Email OTP verification after signup ──── */
        ) : emailSignupStep === 'email_verify' ? (
          <motion.div key="email-verify" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <button onClick={() => { setEmailSignupStep('form'); setEmailOtp(''); setError(''); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="w-4 h-4" />
              {t('auth.back')}
            </button>
            <div className="space-y-1.5 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-foreground">{t('auth.verifyEmail')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('auth.verificationCodeSentTo')} <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <div className="flex justify-center" dir="ltr">
              <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                <InputOTPGroup className="gap-1.5">
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg rounded-lg border-border/50 bg-muted/30" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button onClick={handleEmailOtpVerify} disabled={isEmailOtpLoading || emailOtp.length !== 6} className={primaryBtnCls}>
              {isEmailOtpLoading ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{t('auth.verifying')}</> : t('auth.confirm')}
            </Button>
            <button onClick={handleResendEmailOtp} disabled={isEmailLoading} className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors">
              {isEmailLoading ? t('auth.processing') : t('auth.resendCode')}
            </button>
          </motion.div>

        /* ─── Main form ──── */
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

            {/* Social buttons — students only, full-width stacked */}
            {accountType === 'student' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2.5">
                  <Button variant="outline" onClick={() => handleSocialLogin('google')} disabled={!!isSocialLoading}
                    className="w-full h-11 rounded-xl text-sm font-medium border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all justify-center gap-3">
                    {isSocialLoading === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>{t('auth.continueWithGoogle')}</span>
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => handleSocialLogin('apple')} disabled={!!isSocialLoading}
                    className="w-full h-11 rounded-xl text-sm font-medium border-border/50 hover:bg-muted/40 hover:border-border/80 transition-all justify-center gap-3">
                    {isSocialLoading === 'apple' ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        <span>{t('auth.continueWithApple')}</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/30" /></div>
                  <div className="relative flex justify-center"><span className="px-4 text-xs text-muted-foreground bg-background">{t('auth.orContinueWith')}</span></div>
                </div>
              </div>
            )}

            {/* Email fields — always visible for students, primary for institutions */}
            <div className="space-y-3">
              {mode === 'signup' && (
                <Input type="text" placeholder={accountType === 'institution' ? t('auth.institutionName') : t('auth.fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-border/40 text-sm" autoFocus={accountType === 'institution'} />
              )}
              <Input type="email" placeholder={t('auth.emailAddress')} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
                className="h-11 rounded-xl bg-muted/30 border-border/40 text-left text-sm" autoFocus={mode === 'login' && accountType === 'institution'} />
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
                  className="h-11 rounded-xl bg-muted/30 border-border/40 text-left pl-10 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEmailSubmit(); } }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signup' && <PasswordStrengthMeter password={password} />}
              {mode === 'login' && (
                <div className="text-end">
                  <button onClick={() => { setShowForgotPassword(true); setError(''); }} className="text-xs text-primary hover:underline">
                    {t('auth.forgotPassword')}
                  </button>
                </div>
              )}
              <Button onClick={handleEmailSubmit} disabled={isEmailLoading || (mode === 'login' ? !isEmailValid : !isSignupEmailValid)} className={primaryBtnCls}>
                {isEmailLoading ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{t('auth.processing')}</> : mode === 'login' ? t('auth.login') : t('auth.signup')}
              </Button>
            </div>

            {/* Phone — students only, below a second "or" divider */}
            {accountType === 'student' && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/30" /></div>
                  <div className="relative flex justify-center"><span className="px-4 text-xs text-muted-foreground bg-background">{t('auth.orContinueWith')}</span></div>
                </div>

                {/* Phone + Send Code — inline row */}
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <SmartPhoneInput value={phone} onChange={(v) => { setPhone(v); setOtpStep('input'); setOtp(''); }} onSubmit={isPhoneValid ? handlePhoneSubmit : undefined} />
                  </div>
                  <Button variant="outline" onClick={handlePhoneSubmit} disabled={isLoading || !isPhoneValid || otpStep === 'verify'}
                    className="h-11 rounded-xl text-sm font-medium border-border/50 hover:bg-muted/40 transition-all whitespace-nowrap px-4 shrink-0">
                    {isLoading && otpStep !== 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t('auth.sendCode')}</>}
                  </Button>
                </div>

                {/* Inline OTP input — appears after code sent */}
                <AnimatePresence>
                  {otpStep === 'verify' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-3"
                    >
                      <p className="text-xs text-muted-foreground text-center">
                        {t('auth.codeSentTo')} <span dir="ltr" className="font-mono text-foreground">{maskedPhone}</span>
                      </p>
                      <div className="flex gap-2 items-center justify-center" dir="ltr">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup className="gap-1.5">
                            {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-10 h-11 text-base rounded-lg border-border/50 bg-muted/30" />)}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button onClick={handleOTPVerify} disabled={isLoading || otp.length !== 6} className={primaryBtnCls}>
                        {isLoading ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />{t('auth.verifying')}</> : t('auth.confirm')}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Activation notice — compact, signup only */}
            {accountType === 'student' && mode === 'signup' && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-snug">{t('auth.phoneActivationNote')}</p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Guest — minimal footer link */}
            {accountType === 'student' && (
              <button onClick={handleContinueAsGuest} disabled={isLoading}
                className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-1">
                {t('auth.continueAsGuest')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
