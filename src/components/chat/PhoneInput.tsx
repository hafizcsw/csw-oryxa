import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  disabled?: boolean;
}

const COUNTRY_CODES = [
  { code: '+966', flag: '🇸🇦', name: 'السعودية', minLength: 9 },
  { code: '+971', flag: '🇦🇪', name: 'الإمارات', minLength: 9 },
  { code: '+965', flag: '🇰🇼', name: 'الكويت', minLength: 8 },
  { code: '+973', flag: '🇧🇭', name: 'البحرين', minLength: 8 },
  { code: '+968', flag: '🇴🇲', name: 'عُمان', minLength: 8 },
  { code: '+974', flag: '🇶🇦', name: 'قطر', minLength: 8 },
  { code: '+20', flag: '🇪🇬', name: 'مصر', minLength: 10 },
  { code: '+962', flag: '🇯🇴', name: 'الأردن', minLength: 9 },
  { code: '+961', flag: '🇱🇧', name: 'لبنان', minLength: 7 },
  { code: '+212', flag: '🇲🇦', name: 'المغرب', minLength: 9 },
  { code: '+90', flag: '🇹🇷', name: 'تركيا', minLength: 10 },
  { code: '+7', flag: '🇷🇺', name: 'روسيا', minLength: 10 },
];

export function PhoneInput({ onSubmit, disabled }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState('+966');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const normalizePhone = (input: string): string => {
    // إزالة جميع الرموز غير الرقمية
    let cleaned = input.replace(/\D/g, '');
    
    // إزالة الصفر الأول إن وجد
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  };

  const handleSubmit = () => {
    const cleaned = normalizePhone(phone);
    
    if (!cleaned) {
      setError('الرجاء إدخال رقم الهاتف');
      return;
    }

    const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode);
    if (selectedCountry && cleaned.length < selectedCountry.minLength) {
      setError(`رقم الهاتف قصير جداً (الحد الأدنى ${selectedCountry.minLength} أرقام)`);
      return;
    }

    // إنشاء الرقم الكامل مع كود الدولة
    const fullPhone = `${countryCode}${cleaned}`;
    
    setError('');
    onSubmit(fullPhone);
  };

  return (
    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="w-4 h-4" />
        <span>يرجى إدخال رقم الهاتف للمتابعة</span>
      </div>
      <div className="flex gap-2" dir="ltr">
        <Select value={countryCode} onValueChange={setCountryCode} disabled={disabled}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          placeholder="501234567"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) {
              handleSubmit();
            }
          }}
          disabled={disabled}
          className="flex-1"
        />
        <Button onClick={handleSubmit} disabled={disabled || !phone.trim()}>
          إرسال
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive text-right">{error}</p>
      )}
    </div>
  );
}
