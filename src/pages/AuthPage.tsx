import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AuthSidePanel } from '@/components/auth/AuthSidePanel';
import { AuthFormCard } from '@/components/auth/AuthFormCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Home } from 'lucide-react';
import OryxaLogo from '@/assets/oryxa-logo.png';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  
  const modeParam = searchParams.get('mode');
  const typeParam = searchParams.get('type');

  const defaultMode = modeParam === 'signup' ? 'signup' : 'login';
  const defaultType = typeParam === 'institution' ? 'institution' : 'student';

  const [accountType, setAccountType] = useState<'student' | 'institution'>(defaultType);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Left: Dynamic sales panel (desktop) */}
      <div className="hidden lg:block w-[48%] xl:w-[52%] p-5">
        <div className="h-full">
          <AuthSidePanel accountType={accountType} />
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar with logo + language switcher */}
        <div className="flex items-center justify-between py-4 px-6">
          <img src={OryxaLogo} alt="ORYXA" className="h-8 w-auto object-contain lg:opacity-0" />
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1.5 py-1 shadow-sm">
            <Link to="/" className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent transition-colors" title={t('nav.home')}>
              <Home className="w-4 h-4" />
            </Link>
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-6 lg:py-10">
          <div className="w-full max-w-[440px]">
            {/* Page header */}
            <div className="mb-10 text-center lg:text-start">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {defaultMode === 'login' ? t('auth.page.loginTitle') : t('auth.page.signupTitle')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {defaultMode === 'login' 
                  ? t(accountType === 'institution' ? 'auth.page.loginSubtitleInstitution' : 'auth.page.loginSubtitle')
                  : t(accountType === 'institution' ? 'auth.page.signupSubtitleInstitution' : 'auth.page.signupSubtitle')}
              </p>
            </div>
            
            <AuthFormCard 
              defaultMode={defaultMode as 'login' | 'signup'} 
              defaultAccountType={defaultType as 'student' | 'institution'}
              onSuccess={() => navigate('/')}
              onAccountTypeChange={setAccountType}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="py-4 text-center">
          <p className="text-[11px] text-muted-foreground/60">
            {t('auth.brand.trust')}
          </p>
        </div>
      </div>
    </div>
  );
}