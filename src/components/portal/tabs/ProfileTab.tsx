import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Lock } from "lucide-react";
import type { StudentProfile, StudentPortalProfile } from "@/hooks/useStudentProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabNavigation } from "./TabNavigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProfileTabProps {
  profile: StudentProfile;
  crmProfile: StudentPortalProfile | null;
  onUpdate: (payload: Partial<StudentPortalProfile>) => Promise<boolean>;
  onRefetch?: () => void;
  onTabChange?: (tab: string) => void;
}

// Section Header Component
function SectionHeader({
  icon: Icon,
  title,
  description
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return <div className="flex items-start gap-3 mb-6">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>;
}

// Form Field Component
function FormField({
  label,
  required,
  children,
  hint,
  className = ""
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-foreground block">
        {label}
        {required && <span className="text-destructive mr-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>;
}

export function ProfileTab({
  profile,
  crmProfile,
  onUpdate,
  onRefetch,
  onTabChange
}: ProfileTabProps) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    gender: '',
    birth_year: '',
    dob: '',
    citizenship: '',
    country: profile?.country || ''
  });

  // Sync form data with crmProfile when it loads
  useEffect(() => {
    if (crmProfile) {
      setFormData(prev => ({
        ...prev,
        full_name: crmProfile.full_name || prev.full_name,
        phone: crmProfile.phone_e164 || crmProfile.phone || prev.phone,
        email: crmProfile.email || prev.email,
        country: crmProfile.country || prev.country,
        citizenship: crmProfile.citizenship || prev.citizenship,
        gender: crmProfile.gender || prev.gender,
        birth_year: crmProfile.birth_year || prev.birth_year,
        dob: crmProfile.dob || prev.dob,
      }));
    }
  }, [crmProfile]);

  const isProfileLocked = crmProfile?.profile_locked === true;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    console.log('[ProfileTab] 🚀 Save button clicked, starting save...');
    
    const payload = {
      full_name: formData.full_name || null,
      country: formData.country || null,
      citizenship: formData.citizenship || null,
      gender: formData.gender || null,
      birth_year: formData.birth_year || null,
      dob: formData.dob || null,
    };
    
    console.log('[ProfileTab] 📤 Payload being sent:', {
      keys: Object.keys(payload),
      dob: formData.dob,
      birth_year: formData.birth_year,
    });
    
    try {
      const success = await onUpdate(payload);
      console.log('[ProfileTab] Save result:', success ? '✅ Success' : '❌ Failed');
    } catch (error) {
      console.error('[ProfileTab] ❌ Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return <div className="space-y-8">
      {/* Profile Lock Banner */}
      {isProfileLocked && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-800 dark:text-amber-200">{t('portal.profile.locked')}</span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {crmProfile?.profile_lock_reason || t('portal.profile.lockedDesc')}
          </p>
        </div>
      )}

      {/* Personal Information Section */}
      <div className="bg-card rounded-xl border border-border p-6">
        <SectionHeader icon={User} title={t('portal.profile.title')} description={t('portal.profile.subtitle')} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label={t('portal.profile.fullName')} required hint={t('portal.profile.fullNameHint')}>
            <Input value={formData.full_name} onChange={e => handleChange('full_name', e.target.value)} placeholder={t('portal.profile.fullNamePlaceholder')} className="h-12 bg-background text-base" disabled={isProfileLocked} />
          </FormField>
          
          <FormField label={t('portal.profile.phone')} required hint={t('portal.profile.phoneHint')}>
            <div className="flex gap-2">
              <Input value={formData.phone} readOnly disabled placeholder="+966 5XX XXX XXXX" className="h-12 bg-muted text-base cursor-not-allowed flex-1" dir="ltr" />
              <Button type="button" variant="outline" size="sm" className="h-12 px-4 whitespace-nowrap" onClick={() => window.open('https://wa.me/966920033417?text=أريد تغيير رقم الهاتف المسجل في حسابي', '_blank')}>
                {t('portal.profile.change')}
              </Button>
            </div>
          </FormField>

          <FormField label={t('portal.profile.gender')}>
            <Select value={formData.gender} onValueChange={value => handleChange('gender', value)} disabled={isProfileLocked}>
              <SelectTrigger className="h-12 bg-background text-base">
                <SelectValue placeholder={t('portal.profile.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('portal.profile.male')}</SelectItem>
                <SelectItem value="female">{t('portal.profile.female')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={t('portal.profile.dob')} hint={t('portal.profile.dobHint')}>
            <Input 
              type="date" 
              value={formData.dob} 
              onChange={e => handleChange('dob', e.target.value)} 
              className="h-12 bg-background text-base" 
              dir="ltr"
              disabled={isProfileLocked}
            />
          </FormField>

          <FormField label={t('portal.profile.birthYear')} hint={t('portal.profile.birthYearHint')}>
            <Input value={formData.birth_year} onChange={e => handleChange('birth_year', e.target.value)} placeholder="1995" className="h-12 bg-background text-base" type="number" min="1950" max="2010" disabled={isProfileLocked} />
          </FormField>
          
          <FormField label={t('portal.profile.citizenship')} hint={t('portal.profile.citizenshipHint')}>
            <Input value={formData.citizenship} onChange={e => handleChange('citizenship', e.target.value)} placeholder={t('portal.profile.citizenshipPlaceholder')} className="h-12 bg-background text-base" disabled={isProfileLocked} />
          </FormField>

          <FormField label={t('portal.profile.country')}>
            <Input value={formData.country} onChange={e => handleChange('country', e.target.value)} placeholder={t('portal.profile.countryPlaceholder')} className="h-12 bg-background text-base" disabled={isProfileLocked} />
          </FormField>
        </div>
      </div>

      {/* Save Button - Sticky at bottom */}
      <div className="bg-card rounded-xl border border-border p-4 sticky bottom-4 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isProfileLocked ? t('portal.profile.lockedMessage') : t('portal.profile.confirmSave')}
          </p>
          <Button onClick={handleSaveProfile} disabled={isSaving || isProfileLocked} size="lg" className="px-10 h-12 text-base">
            {isSaving ? <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                {t('portal.profile.saving')}
              </> : t('portal.profile.saveAll')}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      {onTabChange && <TabNavigation currentTab="profile" onTabChange={onTabChange} />}
    </div>;
}
