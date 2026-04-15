import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OTPInputProps {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}

export function OTPInput({ onSubmit, disabled }: OTPInputProps) {
  const { t, language } = useLanguage();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const cleaned = code.trim();
    if (!cleaned) {
      setError(t('otp.enterCode'));
      return;
    }
    if (cleaned.length < 4) {
      setError(t('otp.codeTooShort'));
      return;
    }
    setError('');
    onSubmit(cleaned);
  };

  return (
    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4" />
        <span>{t('otp.enterCodeSent')}</span>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="123456"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) {
              handleSubmit();
            }
          }}
          disabled={disabled}
          className="flex-1 text-center text-lg tracking-widest"
          maxLength={6}
          dir="ltr"
        />
        <Button onClick={handleSubmit} disabled={disabled || !code.trim()}>
          {t('otp.verify')}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}