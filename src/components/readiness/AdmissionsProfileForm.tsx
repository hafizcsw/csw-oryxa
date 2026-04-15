import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import type { ReadinessProfile } from '@/features/readiness/types';

interface AdmissionsProfileFormProps {
  profile: ReadinessProfile;
  onChange: (profile: ReadinessProfile) => void;
  onSave?: () => void;
}

export function AdmissionsProfileForm({ profile, onChange, onSave }: AdmissionsProfileFormProps) {
  const { t } = useLanguage();

  const update = useCallback((field: keyof ReadinessProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  }, [profile, onChange]);

  return (
    <div className="space-y-6">
      {/* Academic Background */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('readiness.profile.academic_background')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('readiness.profile.current_qualification')}</Label>
            <Select value={profile.current_qualification || ''} onValueChange={v => update('current_qualification', v)}>
              <SelectTrigger><SelectValue placeholder={t('readiness.profile.select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high_school">{t('readiness.profile.qualifications.high_school')}</SelectItem>
                <SelectItem value="diploma">{t('readiness.profile.qualifications.diploma')}</SelectItem>
                <SelectItem value="bachelor">{t('readiness.profile.qualifications.bachelor')}</SelectItem>
                <SelectItem value="master">{t('readiness.profile.qualifications.master')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.curriculum')}</Label>
            <Select value={profile.curriculum || ''} onValueChange={v => update('curriculum', v)}>
              <SelectTrigger><SelectValue placeholder={t('readiness.profile.select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="american">{t('readiness.profile.curricula.american')}</SelectItem>
                <SelectItem value="british">{t('readiness.profile.curricula.british')}</SelectItem>
                <SelectItem value="ib">{t('readiness.profile.curricula.ib')}</SelectItem>
                <SelectItem value="national">{t('readiness.profile.curricula.national')}</SelectItem>
                <SelectItem value="other">{t('readiness.profile.curricula.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.gpa')}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                value={profile.gpa || ''}
                onChange={e => update('gpa', parseFloat(e.target.value) || undefined)}
                placeholder="3.5"
                className="flex-1"
              />
              <Select value={String(profile.gpa_scale || 4)} onValueChange={v => update('gpa_scale', parseInt(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">/ 4.0</SelectItem>
                  <SelectItem value="5">/ 5.0</SelectItem>
                  <SelectItem value="100">/ 100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Target Preferences */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('readiness.profile.target_preferences')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('readiness.profile.target_country')}</Label>
            <Input
              value={profile.target_country || ''}
              onChange={e => update('target_country', e.target.value)}
              placeholder={t('readiness.profile.target_country_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.target_degree')}</Label>
            <Select value={profile.target_degree || ''} onValueChange={v => update('target_degree', v)}>
              <SelectTrigger><SelectValue placeholder={t('readiness.profile.select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="foundation">{t('readiness.profile.degrees.foundation')}</SelectItem>
                <SelectItem value="bachelor">{t('readiness.profile.degrees.bachelor')}</SelectItem>
                <SelectItem value="master">{t('readiness.profile.degrees.master')}</SelectItem>
                <SelectItem value="phd">{t('readiness.profile.degrees.phd')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.budget')}</Label>
            <Input
              type="number"
              value={profile.budget_usd || ''}
              onChange={e => update('budget_usd', parseInt(e.target.value) || undefined)}
              placeholder="15000"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.intake')}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={profile.intake_year || ''}
                onChange={e => update('intake_year', parseInt(e.target.value) || undefined)}
                placeholder="2025"
                className="flex-1"
              />
              <Select value={profile.intake_semester || ''} onValueChange={v => update('intake_semester', v)}>
                <SelectTrigger className="w-28"><SelectValue placeholder={t('readiness.profile.semester')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fall">{t('readiness.profile.semesters.fall')}</SelectItem>
                  <SelectItem value="spring">{t('readiness.profile.semesters.spring')}</SelectItem>
                  <SelectItem value="summer">{t('readiness.profile.semesters.summer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.language_of_study')}</Label>
            <Select value={profile.language_of_study || ''} onValueChange={v => update('language_of_study', v)}>
              <SelectTrigger><SelectValue placeholder={t('readiness.profile.select')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('readiness.profile.study_languages.english')}</SelectItem>
                <SelectItem value="ar">{t('readiness.profile.study_languages.arabic')}</SelectItem>
                <SelectItem value="fr">{t('readiness.profile.study_languages.french')}</SelectItem>
                <SelectItem value="de">{t('readiness.profile.study_languages.german')}</SelectItem>
                <SelectItem value="ru">{t('readiness.profile.study_languages.russian')}</SelectItem>
                <SelectItem value="zh">{t('readiness.profile.study_languages.chinese')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <Checkbox
              id="scholarship"
              checked={profile.scholarship_needed || false}
              onCheckedChange={v => update('scholarship_needed', v)}
            />
            <Label htmlFor="scholarship" className="cursor-pointer">{t('readiness.profile.scholarship_needed')}</Label>
          </div>
        </div>
      </section>

      {/* Test Scores */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('readiness.profile.test_scores')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('readiness.profile.english_test')}</Label>
            <div className="flex gap-2">
              <Select value={profile.english_test_type || 'none'} onValueChange={v => update('english_test_type', v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('readiness.profile.none')}</SelectItem>
                  <SelectItem value="ielts">IELTS</SelectItem>
                  <SelectItem value="toefl">TOEFL</SelectItem>
                  <SelectItem value="duolingo">Duolingo</SelectItem>
                  <SelectItem value="pte">PTE</SelectItem>
                </SelectContent>
              </Select>
              {profile.english_test_type && profile.english_test_type !== 'none' && (
                <Input
                  type="number"
                  step="0.5"
                  value={profile.english_test_score || ''}
                  onChange={e => update('english_test_score', parseFloat(e.target.value) || undefined)}
                  placeholder={t('readiness.profile.score')}
                  className="flex-1"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('readiness.profile.other_test')}</Label>
            <div className="flex gap-2">
              <Select value={profile.other_test_type || 'none'} onValueChange={v => update('other_test_type', v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('readiness.profile.none')}</SelectItem>
                  <SelectItem value="sat">SAT</SelectItem>
                  <SelectItem value="act">ACT</SelectItem>
                  <SelectItem value="gre">GRE</SelectItem>
                  <SelectItem value="gmat">GMAT</SelectItem>
                </SelectContent>
              </Select>
              {profile.other_test_type && profile.other_test_type !== 'none' && (
                <Input
                  type="number"
                  value={profile.other_test_score || ''}
                  onChange={e => update('other_test_score', parseInt(e.target.value) || undefined)}
                  placeholder={t('readiness.profile.score')}
                  className="flex-1"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      {onSave && (
        <div className="flex justify-end pt-4">
          <Button onClick={onSave} className="gap-2">
            <Save className="h-4 w-4" />
            {t('readiness.profile.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
