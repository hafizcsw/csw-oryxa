import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Country {
  iso2: string;
  dialCode: string;
  flag: string;
  minLength: number;
}

const COUNTRIES: Country[] = [
  // GCC
  { iso2: 'SA', dialCode: '+966', flag: '🇸🇦', minLength: 9 },
  { iso2: 'AE', dialCode: '+971', flag: '🇦🇪', minLength: 9 },
  { iso2: 'KW', dialCode: '+965', flag: '🇰🇼', minLength: 8 },
  { iso2: 'BH', dialCode: '+973', flag: '🇧🇭', minLength: 8 },
  { iso2: 'OM', dialCode: '+968', flag: '🇴🇲', minLength: 8 },
  { iso2: 'QA', dialCode: '+974', flag: '🇶🇦', minLength: 8 },
  // MENA
  { iso2: 'EG', dialCode: '+20', flag: '🇪🇬', minLength: 10 },
  { iso2: 'JO', dialCode: '+962', flag: '🇯🇴', minLength: 9 },
  { iso2: 'LB', dialCode: '+961', flag: '🇱🇧', minLength: 7 },
  { iso2: 'MA', dialCode: '+212', flag: '🇲🇦', minLength: 9 },
  { iso2: 'DZ', dialCode: '+213', flag: '🇩🇿', minLength: 9 },
  { iso2: 'TN', dialCode: '+216', flag: '🇹🇳', minLength: 8 },
  { iso2: 'LY', dialCode: '+218', flag: '🇱🇾', minLength: 9 },
  { iso2: 'SD', dialCode: '+249', flag: '🇸🇩', minLength: 9 },
  { iso2: 'IQ', dialCode: '+964', flag: '🇮🇶', minLength: 10 },
  { iso2: 'SY', dialCode: '+963', flag: '🇸🇾', minLength: 9 },
  { iso2: 'YE', dialCode: '+967', flag: '🇾🇪', minLength: 9 },
  { iso2: 'PS', dialCode: '+970', flag: '🇵🇸', minLength: 9 },
  // Africa
  { iso2: 'NG', dialCode: '+234', flag: '🇳🇬', minLength: 10 },
  { iso2: 'KE', dialCode: '+254', flag: '🇰🇪', minLength: 9 },
  { iso2: 'GH', dialCode: '+233', flag: '🇬🇭', minLength: 9 },
  { iso2: 'ET', dialCode: '+251', flag: '🇪🇹', minLength: 9 },
  { iso2: 'ZA', dialCode: '+27', flag: '🇿🇦', minLength: 9 },
  { iso2: 'TZ', dialCode: '+255', flag: '🇹🇿', minLength: 9 },
  { iso2: 'UG', dialCode: '+256', flag: '🇺🇬', minLength: 9 },
  { iso2: 'CM', dialCode: '+237', flag: '🇨🇲', minLength: 9 },
  { iso2: 'SN', dialCode: '+221', flag: '🇸🇳', minLength: 9 },
  { iso2: 'CI', dialCode: '+225', flag: '🇨🇮', minLength: 10 },
  { iso2: 'MG', dialCode: '+261', flag: '🇲🇬', minLength: 9 },
  { iso2: 'MZ', dialCode: '+258', flag: '🇲🇿', minLength: 9 },
  { iso2: 'AO', dialCode: '+244', flag: '🇦🇴', minLength: 9 },
  { iso2: 'ZM', dialCode: '+260', flag: '🇿🇲', minLength: 9 },
  { iso2: 'ZW', dialCode: '+263', flag: '🇿🇼', minLength: 9 },
  { iso2: 'BW', dialCode: '+267', flag: '🇧🇼', minLength: 7 },
  { iso2: 'NA', dialCode: '+264', flag: '🇳🇦', minLength: 7 },
  { iso2: 'RW', dialCode: '+250', flag: '🇷🇼', minLength: 9 },
  { iso2: 'ML', dialCode: '+223', flag: '🇲🇱', minLength: 8 },
  { iso2: 'BF', dialCode: '+226', flag: '🇧🇫', minLength: 8 },
  { iso2: 'NE', dialCode: '+227', flag: '🇳🇪', minLength: 8 },
  { iso2: 'TD', dialCode: '+235', flag: '🇹🇩', minLength: 8 },
  { iso2: 'SO', dialCode: '+252', flag: '🇸🇴', minLength: 7 },
  { iso2: 'ER', dialCode: '+291', flag: '🇪🇷', minLength: 7 },
  { iso2: 'DJ', dialCode: '+253', flag: '🇩🇯', minLength: 8 },
  { iso2: 'MR', dialCode: '+222', flag: '🇲🇷', minLength: 8 },
  { iso2: 'GM', dialCode: '+220', flag: '🇬🇲', minLength: 7 },
  { iso2: 'GN', dialCode: '+224', flag: '🇬🇳', minLength: 9 },
  { iso2: 'SL', dialCode: '+232', flag: '🇸🇱', minLength: 8 },
  { iso2: 'LR', dialCode: '+231', flag: '🇱🇷', minLength: 7 },
  { iso2: 'TG', dialCode: '+228', flag: '🇹🇬', minLength: 8 },
  { iso2: 'BJ', dialCode: '+229', flag: '🇧🇯', minLength: 8 },
  { iso2: 'MU', dialCode: '+230', flag: '🇲🇺', minLength: 8 },
  { iso2: 'GA', dialCode: '+241', flag: '🇬🇦', minLength: 7 },
  { iso2: 'CG', dialCode: '+242', flag: '🇨🇬', minLength: 9 },
  { iso2: 'CD', dialCode: '+243', flag: '🇨🇩', minLength: 9 },
  { iso2: 'CF', dialCode: '+236', flag: '🇨🇫', minLength: 8 },
  { iso2: 'GQ', dialCode: '+240', flag: '🇬🇶', minLength: 9 },
  { iso2: 'MW', dialCode: '+265', flag: '🇲🇼', minLength: 7 },
  { iso2: 'LS', dialCode: '+266', flag: '🇱🇸', minLength: 8 },
  { iso2: 'SZ', dialCode: '+268', flag: '🇸🇿', minLength: 8 },
  { iso2: 'KM', dialCode: '+269', flag: '🇰🇲', minLength: 7 },
  { iso2: 'SC', dialCode: '+248', flag: '🇸🇨', minLength: 7 },
  { iso2: 'CV', dialCode: '+238', flag: '🇨🇻', minLength: 7 },
  { iso2: 'ST', dialCode: '+239', flag: '🇸🇹', minLength: 7 },
  { iso2: 'GW', dialCode: '+245', flag: '🇬🇼', minLength: 7 },
  { iso2: 'BI', dialCode: '+257', flag: '🇧🇮', minLength: 8 },
  { iso2: 'SS', dialCode: '+211', flag: '🇸🇸', minLength: 9 },
  // Asia — Central
  { iso2: 'UZ', dialCode: '+998', flag: '🇺🇿', minLength: 9 },
  { iso2: 'KZ', dialCode: '+7', flag: '🇰🇿', minLength: 10 },
  { iso2: 'KG', dialCode: '+996', flag: '🇰🇬', minLength: 9 },
  { iso2: 'TJ', dialCode: '+992', flag: '🇹🇯', minLength: 9 },
  { iso2: 'TM', dialCode: '+993', flag: '🇹🇲', minLength: 8 },
  { iso2: 'AZ', dialCode: '+994', flag: '🇦🇿', minLength: 9 },
  { iso2: 'GE', dialCode: '+995', flag: '🇬🇪', minLength: 9 },
  { iso2: 'AM', dialCode: '+374', flag: '🇦🇲', minLength: 8 },
  { iso2: 'MN', dialCode: '+976', flag: '🇲🇳', minLength: 8 },
  { iso2: 'AF', dialCode: '+93', flag: '🇦🇫', minLength: 9 },
  // Asia — South & Southeast
  { iso2: 'TR', dialCode: '+90', flag: '🇹🇷', minLength: 10 },
  { iso2: 'RU', dialCode: '+7', flag: '🇷🇺', minLength: 10 },
  { iso2: 'IN', dialCode: '+91', flag: '🇮🇳', minLength: 10 },
  { iso2: 'PK', dialCode: '+92', flag: '🇵🇰', minLength: 10 },
  { iso2: 'BD', dialCode: '+880', flag: '🇧🇩', minLength: 10 },
  { iso2: 'ID', dialCode: '+62', flag: '🇮🇩', minLength: 10 },
  { iso2: 'MY', dialCode: '+60', flag: '🇲🇾', minLength: 9 },
  { iso2: 'PH', dialCode: '+63', flag: '🇵🇭', minLength: 10 },
  { iso2: 'LK', dialCode: '+94', flag: '🇱🇰', minLength: 9 },
  { iso2: 'NP', dialCode: '+977', flag: '🇳🇵', minLength: 10 },
  { iso2: 'MM', dialCode: '+95', flag: '🇲🇲', minLength: 8 },
  { iso2: 'TH', dialCode: '+66', flag: '🇹🇭', minLength: 9 },
  { iso2: 'VN', dialCode: '+84', flag: '🇻🇳', minLength: 9 },
  { iso2: 'KH', dialCode: '+855', flag: '🇰🇭', minLength: 8 },
  { iso2: 'LA', dialCode: '+856', flag: '🇱🇦', minLength: 8 },
  { iso2: 'SG', dialCode: '+65', flag: '🇸🇬', minLength: 8 },
  { iso2: 'BN', dialCode: '+673', flag: '🇧🇳', minLength: 7 },
  { iso2: 'TL', dialCode: '+670', flag: '🇹🇱', minLength: 7 },
  { iso2: 'MV', dialCode: '+960', flag: '🇲🇻', minLength: 7 },
  { iso2: 'BT', dialCode: '+975', flag: '🇧🇹', minLength: 8 },
  // Asia — East
  { iso2: 'CN', dialCode: '+86', flag: '🇨🇳', minLength: 11 },
  { iso2: 'JP', dialCode: '+81', flag: '🇯🇵', minLength: 10 },
  { iso2: 'KR', dialCode: '+82', flag: '🇰🇷', minLength: 10 },
  { iso2: 'TW', dialCode: '+886', flag: '🇹🇼', minLength: 9 },
  { iso2: 'HK', dialCode: '+852', flag: '🇭🇰', minLength: 8 },
  { iso2: 'MO', dialCode: '+853', flag: '🇲🇴', minLength: 8 },
  // Europe — Western
  { iso2: 'GB', dialCode: '+44', flag: '🇬🇧', minLength: 10 },
  { iso2: 'DE', dialCode: '+49', flag: '🇩🇪', minLength: 10 },
  { iso2: 'FR', dialCode: '+33', flag: '🇫🇷', minLength: 9 },
  { iso2: 'IT', dialCode: '+39', flag: '🇮🇹', minLength: 10 },
  { iso2: 'ES', dialCode: '+34', flag: '🇪🇸', minLength: 9 },
  { iso2: 'NL', dialCode: '+31', flag: '🇳🇱', minLength: 9 },
  { iso2: 'BE', dialCode: '+32', flag: '🇧🇪', minLength: 9 },
  { iso2: 'PT', dialCode: '+351', flag: '🇵🇹', minLength: 9 },
  { iso2: 'CH', dialCode: '+41', flag: '🇨🇭', minLength: 9 },
  { iso2: 'AT', dialCode: '+43', flag: '🇦🇹', minLength: 10 },
  { iso2: 'IE', dialCode: '+353', flag: '🇮🇪', minLength: 9 },
  { iso2: 'LU', dialCode: '+352', flag: '🇱🇺', minLength: 9 },
  { iso2: 'MC', dialCode: '+377', flag: '🇲🇨', minLength: 8 },
  { iso2: 'LI', dialCode: '+423', flag: '🇱🇮', minLength: 7 },
  { iso2: 'AD', dialCode: '+376', flag: '🇦🇩', minLength: 6 },
  { iso2: 'MT', dialCode: '+356', flag: '🇲🇹', minLength: 8 },
  // Europe — Nordic
  { iso2: 'SE', dialCode: '+46', flag: '🇸🇪', minLength: 9 },
  { iso2: 'NO', dialCode: '+47', flag: '🇳🇴', minLength: 8 },
  { iso2: 'DK', dialCode: '+45', flag: '🇩🇰', minLength: 8 },
  { iso2: 'FI', dialCode: '+358', flag: '🇫🇮', minLength: 9 },
  { iso2: 'IS', dialCode: '+354', flag: '🇮🇸', minLength: 7 },
  // Europe — Eastern
  { iso2: 'PL', dialCode: '+48', flag: '🇵🇱', minLength: 9 },
  { iso2: 'CZ', dialCode: '+420', flag: '🇨🇿', minLength: 9 },
  { iso2: 'SK', dialCode: '+421', flag: '🇸🇰', minLength: 9 },
  { iso2: 'HU', dialCode: '+36', flag: '🇭🇺', minLength: 9 },
  { iso2: 'RO', dialCode: '+40', flag: '🇷🇴', minLength: 10 },
  { iso2: 'BG', dialCode: '+359', flag: '🇧🇬', minLength: 9 },
  { iso2: 'HR', dialCode: '+385', flag: '🇭🇷', minLength: 9 },
  { iso2: 'RS', dialCode: '+381', flag: '🇷🇸', minLength: 9 },
  { iso2: 'SI', dialCode: '+386', flag: '🇸🇮', minLength: 8 },
  { iso2: 'BA', dialCode: '+387', flag: '🇧🇦', minLength: 8 },
  { iso2: 'ME', dialCode: '+382', flag: '🇲🇪', minLength: 8 },
  { iso2: 'MK', dialCode: '+389', flag: '🇲🇰', minLength: 8 },
  { iso2: 'AL', dialCode: '+355', flag: '🇦🇱', minLength: 9 },
  { iso2: 'XK', dialCode: '+383', flag: '🇽🇰', minLength: 8 },
  { iso2: 'UA', dialCode: '+380', flag: '🇺🇦', minLength: 9 },
  { iso2: 'BY', dialCode: '+375', flag: '🇧🇾', minLength: 9 },
  { iso2: 'MD', dialCode: '+373', flag: '🇲🇩', minLength: 8 },
  { iso2: 'LT', dialCode: '+370', flag: '🇱🇹', minLength: 8 },
  { iso2: 'LV', dialCode: '+371', flag: '🇱🇻', minLength: 8 },
  { iso2: 'EE', dialCode: '+372', flag: '🇪🇪', minLength: 7 },
  { iso2: 'GR', dialCode: '+30', flag: '🇬🇷', minLength: 10 },
  { iso2: 'CY', dialCode: '+357', flag: '🇨🇾', minLength: 8 },
  // Americas
  { iso2: 'US', dialCode: '+1', flag: '🇺🇸', minLength: 10 },
  { iso2: 'CA', dialCode: '+1', flag: '🇨🇦', minLength: 10 },
  { iso2: 'MX', dialCode: '+52', flag: '🇲🇽', minLength: 10 },
  { iso2: 'BR', dialCode: '+55', flag: '🇧🇷', minLength: 10 },
  { iso2: 'AR', dialCode: '+54', flag: '🇦🇷', minLength: 10 },
  { iso2: 'CO', dialCode: '+57', flag: '🇨🇴', minLength: 10 },
  { iso2: 'CL', dialCode: '+56', flag: '🇨🇱', minLength: 9 },
  { iso2: 'PE', dialCode: '+51', flag: '🇵🇪', minLength: 9 },
  { iso2: 'VE', dialCode: '+58', flag: '🇻🇪', minLength: 10 },
  { iso2: 'EC', dialCode: '+593', flag: '🇪🇨', minLength: 9 },
  { iso2: 'BO', dialCode: '+591', flag: '🇧🇴', minLength: 8 },
  { iso2: 'PY', dialCode: '+595', flag: '🇵🇾', minLength: 9 },
  { iso2: 'UY', dialCode: '+598', flag: '🇺🇾', minLength: 8 },
  { iso2: 'CR', dialCode: '+506', flag: '🇨🇷', minLength: 8 },
  { iso2: 'PA', dialCode: '+507', flag: '🇵🇦', minLength: 8 },
  { iso2: 'GT', dialCode: '+502', flag: '🇬🇹', minLength: 8 },
  { iso2: 'HN', dialCode: '+504', flag: '🇭🇳', minLength: 8 },
  { iso2: 'SV', dialCode: '+503', flag: '🇸🇻', minLength: 8 },
  { iso2: 'NI', dialCode: '+505', flag: '🇳🇮', minLength: 8 },
  { iso2: 'CU', dialCode: '+53', flag: '🇨🇺', minLength: 8 },
  { iso2: 'DO', dialCode: '+1', flag: '🇩🇴', minLength: 10 },
  { iso2: 'HT', dialCode: '+509', flag: '🇭🇹', minLength: 8 },
  { iso2: 'JM', dialCode: '+1', flag: '🇯🇲', minLength: 10 },
  { iso2: 'TT', dialCode: '+1', flag: '🇹🇹', minLength: 10 },
  { iso2: 'GY', dialCode: '+592', flag: '🇬🇾', minLength: 7 },
  { iso2: 'SR', dialCode: '+597', flag: '🇸🇷', minLength: 7 },
  { iso2: 'BZ', dialCode: '+501', flag: '🇧🇿', minLength: 7 },
  // Caribbean
  { iso2: 'BS', dialCode: '+1', flag: '🇧🇸', minLength: 10 },
  { iso2: 'BB', dialCode: '+1', flag: '🇧🇧', minLength: 10 },
  // Oceania
  { iso2: 'AU', dialCode: '+61', flag: '🇦🇺', minLength: 9 },
  { iso2: 'NZ', dialCode: '+64', flag: '🇳🇿', minLength: 9 },
  { iso2: 'FJ', dialCode: '+679', flag: '🇫🇯', minLength: 7 },
  { iso2: 'PG', dialCode: '+675', flag: '🇵🇬', minLength: 8 },
  // Middle East (additional)
  { iso2: 'IR', dialCode: '+98', flag: '🇮🇷', minLength: 10 },
  { iso2: 'IL', dialCode: '+972', flag: '🇮🇱', minLength: 9 },
];

interface SmartPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

// Detect default country from browser timezone/locale instead of hardcoding SA
function detectDefaultCountry(): Country {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const locale = navigator.language || '';
    
    // Map timezone regions to country codes
    const tzMap: Record<string, string> = {
      'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE', 'Asia/Kuwait': 'KW',
      'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Qatar': 'QA',
      'Africa/Cairo': 'EG', 'Asia/Amman': 'JO', 'Asia/Beirut': 'LB',
      'Africa/Casablanca': 'MA', 'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN',
      'Asia/Baghdad': 'IQ', 'Asia/Damascus': 'SY', 'Asia/Aden': 'YE',
      'Europe/London': 'GB', 'America/New_York': 'US', 'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR', 'Europe/Istanbul': 'TR', 'Asia/Karachi': 'PK',
      'Asia/Kolkata': 'IN', 'Asia/Dhaka': 'BD', 'Europe/Moscow': 'RU',
      'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
      'America/Sao_Paulo': 'BR', 'Europe/Madrid': 'ES', 'America/Mexico_City': 'MX',
      'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Tashkent': 'UZ',
    };
    
    // Try timezone first
    if (tz && tzMap[tz]) {
      const found = COUNTRIES.find(c => c.iso2 === tzMap[tz]);
      if (found) return found;
    }
    
    // Try locale region (e.g., "ar-SA" → "SA")
    const regionMatch = locale.match(/[-_]([A-Z]{2})$/i);
    if (regionMatch) {
      const code = regionMatch[1].toUpperCase();
      const found = COUNTRIES.find(c => c.iso2 === code);
      if (found) return found;
    }
  } catch {}
  
  // Fallback: first country in list
  return COUNTRIES[0];
}

export function SmartPhoneInput({ value, onChange, disabled, autoFocus, onSubmit }: SmartPhoneInputProps) {
  const { t, language } = useLanguage();
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => detectDefaultCountry());
  const [nationalNumber, setNationalNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Get localized country name using browser's Intl API
  const displayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([language, 'en'], { type: 'region' });
    } catch {
      return null;
    }
  }, [language]);

  const getCountryName = (iso2: string): string => {
    try {
      return displayNames?.of(iso2) || iso2;
    } catch {
      return iso2;
    }
  };

  // Detect country from pasted E.164 number (defined before useEffect)
  const detectCountryFromInput = (input: string): { country: Country; national: string } | null => {
    if (!input.startsWith('+')) return null;
    
    const digits = input.slice(1).replace(/\D/g, '');
    
    // Sort by longest dial code first
    const sorted = [...COUNTRIES].sort((a, b) => 
      b.dialCode.length - a.dialCode.length
    );
    
    for (const country of sorted) {
      const code = country.dialCode.replace('+', '');
      if (digits.startsWith(code)) {
        return {
          country,
          national: digits.slice(code.length)
        };
      }
    }
    return null;
  };

  // Sync internal state when value prop changes from parent
  useEffect(() => {
    if (value && value.startsWith('+')) {
      const detected = detectCountryFromInput(value);
      if (detected) {
        setSelectedCountry(detected.country);
        setNationalNumber(detected.national);
      }
    } else if (!value) {
      // Reset when value is cleared
      setNationalNumber('');
    }
  }, [value]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    
    const normalizedCode = q.replace(/^0+/, '').replace(/^\+/, '');
    
    return COUNTRIES.filter(country => {
      const dialCodeClean = country.dialCode.replace('+', '');
      const countryName = getCountryName(country.iso2).toLowerCase();
      return (
        countryName.includes(q) ||
        dialCodeClean.startsWith(normalizedCode) ||
        country.iso2.toLowerCase() === q
      );
    });
  }, [searchQuery, language]);

  // Handle national number input
  const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Check if user pasted a full E.164 number
    if (input.startsWith('+')) {
      const detected = detectCountryFromInput(input);
      if (detected) {
        setSelectedCountry(detected.country);
        setNationalNumber(detected.national);
        onChange(`${detected.country.dialCode}${detected.national}`);
        return;
      }
    }
    
    // Only allow digits
    const digits = input.replace(/\D/g, '');
    setNationalNumber(digits);
    
    // Build E.164 and emit
    if (digits) {
      onChange(`${selectedCountry.dialCode}${digits}`);
    } else {
      onChange('');
    }
  };

  // Handle country selection
  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearchQuery('');
    
    // Update E.164 with new country code
    if (nationalNumber) {
      onChange(`${country.dialCode}${nationalNumber}`);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2" dir="ltr">
        {/* Country Selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-[100px] justify-between px-2 h-11 shrink-0"
            >
              <span className="flex items-center gap-1 text-sm">
                <span>{selectedCountry.flag}</span>
                <span className="text-muted-foreground">{selectedCountry.dialCode}</span>
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            {/* Search Input */}
            <div className="flex items-center border-b px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground mr-2" />
              <input
                type="text"
                placeholder={t('phone.searchCountry')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                dir="auto"
              />
            </div>
            
            {/* Countries List */}
            <div
              className="max-h-[260px] overflow-y-auto overscroll-contain p-1"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredCountries.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {t('phone.noResults')}
                </p>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={`${country.iso2}-${country.dialCode}`}
                    onClick={() => handleCountrySelect(country)}
                    className={`
                      w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md
                      hover:bg-accent transition-colors text-right
                      ${selectedCountry.iso2 === country.iso2 ? 'bg-accent' : ''}
                    `}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="flex-1">{getCountryName(country.iso2)}</span>
                    <span className="text-muted-foreground text-xs">{country.dialCode}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* National Number Input */}
        <Input
          type="tel"
          inputMode="numeric"
          placeholder={t('phone.placeholder')}
          value={nationalNumber}
          onChange={handleNationalChange}
          disabled={disabled}
          autoFocus={autoFocus}
          className="h-11 flex-1"
          dir="ltr"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
      </div>
      
      {/* Helper Text */}
      <p className="text-xs text-muted-foreground text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {t('phone.whatsappHint')}
      </p>
    </div>
  );
}
