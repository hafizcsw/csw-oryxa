import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { MailX, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function Unsubscribe() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid === false && data.reason === 'already_unsubscribed') setStatus('already');
        else if (data.valid) setStatus('valid');
        else setStatus('invalid');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) setStatus('error');
      else if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'loading' && <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />}

        {status === 'valid' && (
          <>
            <MailX className="h-16 w-16 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">
              {t('unsubscribe.title', { defaultValue: 'Unsubscribe from emails' })}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('unsubscribe.description', { defaultValue: 'Click below to stop receiving notification emails.' })}
            </p>
            <Button onClick={handleConfirm} disabled={processing} size="lg">
              {processing && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t('unsubscribe.confirm', { defaultValue: 'Confirm Unsubscribe' })}
            </Button>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h1 className="text-xl font-bold text-foreground">
              {t('unsubscribe.success', { defaultValue: 'Successfully unsubscribed' })}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('unsubscribe.successDesc', { defaultValue: 'You will no longer receive notification emails.' })}
            </p>
          </>
        )}

        {status === 'already' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">
              {t('unsubscribe.already', { defaultValue: 'Already unsubscribed' })}
            </h1>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
            <h1 className="text-xl font-bold text-foreground">
              {t('unsubscribe.invalid', { defaultValue: 'Invalid or expired link' })}
            </h1>
          </>
        )}
      </div>
    </div>
  );
}
