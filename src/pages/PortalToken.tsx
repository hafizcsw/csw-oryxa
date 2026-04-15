import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * PortalToken page - Single Entry Point enforcement
 * This page ONLY saves the token and redirects to /account
 * The actual portal-verify call happens in /account
 */
export default function PortalToken() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [msg, setMsg] = useState(t('portal.verifyingLink'));

  useEffect(() => {
    if (!token) {
      setMsg(t('portal.tokenMissing'));
      setTimeout(() => navigate('/'), 2000);
      return;
    }

    // Save token to localStorage for /account to use
    localStorage.setItem('student_portal_token', token);
    
    // Set pending flag so /account knows exchange is needed
    const pendingUntil = Date.now() + 15000; // 15 seconds
    sessionStorage.setItem('portal_auth_pending_until', String(pendingUntil));
    sessionStorage.setItem('portal_exchange_token', token);

    console.log('[PortalToken] Token saved, redirecting to /account');
    setMsg(t('portal.verified'));
    
    // Navigate to /account where the actual exchange will happen
    setTimeout(() => navigate('/account'), 300);
  }, [token, navigate, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <h3 className="text-2xl font-bold">{t('portal.studentPortal')}</h3>
          <p className="text-muted-foreground">{msg}</p>
        </CardContent>
      </Card>
    </div>
  );
}