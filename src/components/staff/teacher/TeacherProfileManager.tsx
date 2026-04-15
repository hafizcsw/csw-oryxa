/**
 * TeacherProfileManager — Preply-style profile editor that mirrors the public view.
 * Video at top, sidebar with stats, editable sections below.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { TeacherVideoUpload } from './TeacherVideoUpload';
import { TeacherProfileAiFill } from './TeacherProfileAiFill';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ExternalLink, Eye, FileText, ShieldCheck, Save, Plus, X, Loader2, Globe,
  Star, GraduationCap, BookOpen, Clock, Pencil, Languages, MapPin, DollarSign, Camera
} from 'lucide-react';
import { TeacherScheduleEditor } from './TeacherScheduleEditor';
import { TeacherCertificatesEditor } from './TeacherCertificatesEditor';
import { useTeacherProfile } from '@/hooks/useTeacherProfile';
import { supabase } from '@/integrations/supabase/client';
import { buildAvatarDisplayUrl, optimizeAvatarForUpload } from '@/features/avatar/avatarImageUtils';
import { toast } from 'sonner';

interface Props {
  teacherId?: string;
}

interface PublicProfile {
  display_name: string;
  bio: string;
  teaching_experience: string;
  education: string;
  specialty: string;
  languages_spoken: string[];
  country: string;
  country_code: string;
  price_per_lesson: number | null;
  lesson_duration_minutes: number;
  is_published: boolean;
  teaches_subject: string;
  response_time: string;
  badges: string[];
  rating: number;
  reviews_count: number;
  students_count: number;
  lessons_count: number;
  booked_recently: number;
}

const EMPTY_PROFILE: PublicProfile = {
  display_name: '',
  bio: '',
  teaching_experience: '',
  education: '',
  specialty: '',
  languages_spoken: [],
  country: '',
  country_code: '',
  price_per_lesson: null,
  lesson_duration_minutes: 50,
  is_published: false,
  teaches_subject: 'Russian',
  response_time: '1h',
  badges: [],
  rating: 5,
  reviews_count: 0,
  students_count: 0,
  lessons_count: 0,
  booked_recently: 0,
};

type EditSection = 'name' | 'bio' | 'experience' | 'education' | 'specialty' | 'languages' | 'location' | 'pricing' | 'stats' | 'teaches' | null;

export function TeacherProfileManager({ teacherId }: Props) {
  const { t } = useLanguage();
  const profile = useTeacherProfile(true);
  const [form, setForm] = useState<PublicProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newLang, setNewLang] = useState('');
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const publicProfileUrl = teacherId ? `/languages/teacher/${teacherId}` : null;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Load public profile
      const { data } = await supabase
        .from('teacher_public_profiles' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setForm({
          display_name: d.display_name || '',
          bio: d.bio || '',
          teaching_experience: d.teaching_experience || '',
          education: d.education || '',
          specialty: d.specialty || '',
          languages_spoken: Array.isArray(d.languages_spoken) ? d.languages_spoken : [],
          country: d.country || '',
          country_code: d.country_code || '',
          price_per_lesson: d.price_per_lesson ?? null,
          lesson_duration_minutes: d.lesson_duration_minutes || 50,
          is_published: d.is_published === true,
          teaches_subject: d.teaches_subject || 'Russian',
          response_time: d.response_time || '1h',
          badges: Array.isArray(d.badges) ? d.badges : [],
          rating: d.rating ?? 5,
          reviews_count: d.reviews_count ?? 0,
          students_count: d.students_count ?? 0,
          lessons_count: d.lessons_count ?? 0,
          booked_recently: d.booked_recently ?? 0,
        });
        // Set avatar from teacher_public_profiles first (may be CRM URL)
        if (d.avatar_url) {
          setAvatarUrl(d.avatar_url);
        }
      }

      // Also check profiles table avatar as fallback/override
      const { data: prof } = await supabase
        .from('profiles')
        .select('avatar_storage_path')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (prof?.avatar_storage_path) {
        setAvatarUrl(buildAvatarDisplayUrl(prof.avatar_storage_path));
      }
    } catch (err) {
      console.error('[TeacherProfileManager] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const optimized = await optimizeAvatarForUpload(file);
      const ext = optimized.name.split('.').pop() || 'webp';
      const filePath = `${user.id}/avatar/${Date.now()}_profile.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, optimized, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Update profiles table
      await supabase.from('profiles').upsert(
        { user_id: user.id, avatar_storage_path: filePath },
        { onConflict: 'user_id' }
      );

      // Also update teacher_public_profiles.avatar_url for public display
      const publicUrl = buildAvatarDisplayUrl(filePath);
      await (supabase as any).from('teacher_public_profiles').upsert(
        { user_id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

      setAvatarUrl(publicUrl);
      toast.success(t('staff.teacher.profile.avatarUpdated', { defaultValue: 'Profile photo updated' }));
    } catch (err: any) {
      console.error('[TeacherProfileManager] Avatar upload error:', err);
      toast.error(err?.message || t('common.error', { defaultValue: 'Error' }));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error(t('common.error', { defaultValue: 'Error' }));
        return;
      }

      const payload = {
        user_id: session.user.id,
        display_name: form.display_name || null,
        bio: form.bio || null,
        teaching_experience: form.teaching_experience || null,
        education: form.education || null,
        specialty: form.specialty || null,
        languages_spoken: form.languages_spoken,
        country: form.country || null,
        country_code: form.country_code || null,
        price_per_lesson: form.price_per_lesson,
        lesson_duration_minutes: form.lesson_duration_minutes,
        is_published: form.is_published,
        teaches_subject: form.teaches_subject || null,
        response_time: form.response_time || null,
        badges: form.badges,
        rating: form.rating,
        reviews_count: form.reviews_count,
        students_count: form.students_count,
        lessons_count: form.lessons_count,
        booked_recently: form.booked_recently,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('teacher_public_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success(t('staff.teacher.profile.saved', { defaultValue: 'Profile saved successfully' }));
      setEditSection(null);
    } catch (err: any) {
      console.error('[TeacherProfileManager] Save error:', err);
      toast.error(err?.message || t('common.error', { defaultValue: 'Error' }));
    } finally {
      setSaving(false);
    }
  };

  const addLanguage = () => {
    const trimmed = newLang.trim();
    if (!trimmed) {
      toast.error(t('staff.teacher.profile.enterLanguageFirst', { defaultValue: 'Please type a language name first' }));
      return;
    }
    if (form.languages_spoken.includes(trimmed)) {
      toast.info(t('staff.teacher.profile.languageExists', { defaultValue: 'This language is already added' }));
      setNewLang('');
      return;
    }
    setForm(f => ({ ...f, languages_spoken: [...f.languages_spoken, trimmed] }));
    setNewLang('');
    toast.success(t('staff.teacher.profile.languageAdded', { defaultValue: 'Language added' }));
  };

  const removeLanguage = (lang: string) => {
    setForm(f => ({ ...f, languages_spoken: f.languages_spoken.filter(l => l !== lang) }));
  };

  const updateField = <K extends keyof PublicProfile>(key: K, value: PublicProfile[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleAiSuggestion = (fields: Record<string, any>) => {
    setForm(f => {
      const updated = { ...f };
      for (const [key, val] of Object.entries(fields)) {
        if (key in updated && val !== null && val !== undefined) {
          (updated as any)[key] = val;
        }
      }
      return updated;
    });
  };

  const toggleEdit = (section: EditSection) => {
    setEditSection(prev => prev === section ? null : section);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emptyPlaceholder = (key: string, fallback: string) => (
    <span className="text-muted-foreground italic text-sm">
      {t(key, { defaultValue: fallback })}
    </span>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ═══ HEADER: Title + Publish + Preview ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {t('staff.teacher.profile.title', { defaultValue: 'My Profile' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('staff.teacher.profile.subtitle', { defaultValue: 'Manage your public profile, intro video, and verification materials.' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Switch
              id="publish-toggle"
              checked={form.is_published}
              onCheckedChange={(v) => updateField('is_published', v)}
            />
            <Label htmlFor="publish-toggle" className="text-sm font-medium cursor-pointer">
              {form.is_published
                ? t('staff.teacher.profile.published', { defaultValue: 'Published' })
                : t('staff.teacher.profile.draft', { defaultValue: 'Draft' })}
            </Label>
          </div>
          {publicProfileUrl && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(publicProfileUrl, '_blank')}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t('staff.teacher.profile.view_profile', { defaultValue: 'View Profile' })}
            </Button>
          )}
        </div>
      </div>

      {/* ═══ AI FILL ═══ */}
      <TeacherProfileAiFill currentProfile={form} onApplySuggestion={handleAiSuggestion} />

      {/* ═══ MAIN LAYOUT: Preply-style ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Video + Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Video Section */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <TeacherVideoUpload />
            </CardContent>
          </Card>

          {/* ═══ AVATAR + NAME + COUNTRY (like Preply header) ═══ */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative shrink-0 group">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarImage src={avatarUrl} alt={form.display_name} />
                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                      {form.display_name ? form.display_name.charAt(0).toUpperCase() : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>

                {/* Name + Country */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editSection === 'name' ? (
                      <div className="space-y-3">
                        <Input
                          value={form.display_name}
                          onChange={(e) => updateField('display_name', e.target.value)}
                          placeholder={t('staff.teacher.profile.displayNamePlaceholder', { defaultValue: 'Your name as shown to students' })}
                          className="text-lg font-bold"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            value={form.country}
                            onChange={(e) => updateField('country', e.target.value)}
                            placeholder={t('staff.teacher.profile.countryPlaceholder', { defaultValue: 'e.g. Uzbekistan' })}
                          />
                          <Input
                            value={form.country_code}
                            onChange={(e) => updateField('country_code', e.target.value.toLowerCase())}
                            placeholder="uz"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-2xl font-bold">
                          {form.display_name || emptyPlaceholder('staff.teacher.profile.clickToAddName', 'Click ✎ to add your name')}
                        </h3>
                        {form.country && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {form.country}
                            {form.country_code && (
                              <img
                                src={`https://flagcdn.com/20x15/${form.country_code}.png`}
                                alt={form.country_code}
                                className="inline-block ms-1"
                                width={20} height={15}
                              />
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleEdit('name')} className="shrink-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ═══ ABOUT ME ═══ */}
          <ProfileSection
            icon={<BookOpen className="h-4 w-4" />}
            title={t('staff.teacher.profile.bio', { defaultValue: 'About Me' })}
            isEditing={editSection === 'bio'}
            onToggleEdit={() => toggleEdit('bio')}
            preview={form.bio || null}
            emptyText={t('staff.teacher.profile.bioPlaceholder', { defaultValue: 'Tell students about yourself...' })}
          >
            <Textarea
              value={form.bio}
              onChange={(e) => updateField('bio', e.target.value)}
              placeholder={t('staff.teacher.profile.bioPlaceholder', { defaultValue: 'Tell students about yourself...' })}
              rows={5}
            />
          </ProfileSection>

          {/* ═══ TEACHING EXPERIENCE ═══ */}
          <ProfileSection
            icon={<GraduationCap className="h-4 w-4" />}
            title={t('staff.teacher.profile.teachingExperience', { defaultValue: 'Teaching Experience' })}
            isEditing={editSection === 'experience'}
            onToggleEdit={() => toggleEdit('experience')}
            preview={form.teaching_experience || null}
            emptyText={t('staff.teacher.profile.teachingExperiencePlaceholder', { defaultValue: 'Describe your teaching background...' })}
          >
            <Textarea
              value={form.teaching_experience}
              onChange={(e) => updateField('teaching_experience', e.target.value)}
              placeholder={t('staff.teacher.profile.teachingExperiencePlaceholder', { defaultValue: 'Describe your teaching background...' })}
              rows={4}
            />
          </ProfileSection>

          {/* ═══ EDUCATION ═══ */}
          <ProfileSection
            icon={<GraduationCap className="h-4 w-4" />}
            title={t('staff.teacher.profile.education', { defaultValue: 'Education' })}
            isEditing={editSection === 'education'}
            onToggleEdit={() => toggleEdit('education')}
            preview={form.education || null}
            emptyText={t('staff.teacher.profile.educationPlaceholder', { defaultValue: 'Your degrees and certifications...' })}
          >
            <Textarea
              value={form.education}
              onChange={(e) => updateField('education', e.target.value)}
              placeholder={t('staff.teacher.profile.educationPlaceholder', { defaultValue: 'Your degrees and certifications...' })}
              rows={3}
            />
          </ProfileSection>

          {/* ═══ SPECIALTY ═══ */}
          <ProfileSection
            icon={<Star className="h-4 w-4" />}
            title={t('staff.teacher.profile.specialty', { defaultValue: 'Specialty' })}
            isEditing={editSection === 'specialty'}
            onToggleEdit={() => toggleEdit('specialty')}
            preview={form.specialty || null}
            emptyText={t('staff.teacher.profile.specialtyPlaceholder', { defaultValue: 'e.g. Grammar, Conversation, TORFL prep' })}
          >
            <Input
              value={form.specialty}
              onChange={(e) => updateField('specialty', e.target.value)}
              placeholder={t('staff.teacher.profile.specialtyPlaceholder', { defaultValue: 'e.g. Grammar, Conversation, TORFL prep' })}
            />
          </ProfileSection>

          {/* ═══ LANGUAGES ═══ */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  {t('staff.teacher.profile.languagesSpoken', { defaultValue: 'Languages Spoken' })}
                </h4>
                <Button variant="ghost" size="icon" onClick={() => toggleEdit('languages')}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.languages_spoken.length > 0 ? (
                  form.languages_spoken.map((lang) => (
                    <Badge key={lang} variant="secondary" className="gap-1 pe-1 text-sm py-1">
                      <Globe className="h-3 w-3" />
                      {lang}
                      {editSection === 'languages' && (
                        <button onClick={() => removeLanguage(lang)} className="ms-1 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic text-sm">
                    {t('staff.teacher.profile.noLanguages', { defaultValue: 'No languages added yet' })}
                  </span>
                )}
              </div>
              {editSection === 'languages' && (
                <div className="flex gap-2 mt-3">
                  <Input
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    placeholder={t('staff.teacher.profile.addLanguage', { defaultValue: 'e.g. Russian (Native)' })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addLanguage}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ TEACHES SUBJECT ═══ */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  {t('staff.teacher.profile.teaches', { defaultValue: 'Teaches' })}
                </h4>
                <Button variant="ghost" size="icon" onClick={() => toggleEdit('teaches')}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              {editSection === 'teaches' ? (
                <Input
                  value={form.teaches_subject}
                  onChange={(e) => updateField('teaches_subject', e.target.value)}
                  placeholder={t('staff.teacher.profile.teachesPlaceholder', { defaultValue: 'e.g. Russian' })}
                />
              ) : (
                <p className="text-sm font-medium text-primary">
                  {form.teaches_subject || <span className="text-muted-foreground italic">{t('staff.teacher.profile.teachesPlaceholder', { defaultValue: 'e.g. Russian' })}</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ═══ SCHEDULE / AVAILABILITY ═══ */}
          <div className="-mx-4 sm:mx-0">
            <TeacherScheduleEditor />
          </div>

          {/* ═══ CERTIFICATES ═══ */}
          <TeacherCertificatesEditor />

          {/* ═══ STATS (editable) ═══ */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  {t('staff.teacher.profile.statsTitle', { defaultValue: 'Statistics & Badges' })}
                </h4>
                <Button variant="ghost" size="icon" onClick={() => toggleEdit('stats')}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              {editSection === 'stats' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.rating', { defaultValue: 'Rating' })}</Label>
                    <Input type="number" min={0} max={5} step={0.1} value={form.rating} onChange={(e) => updateField('rating', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.reviewsCount', { defaultValue: 'Reviews' })}</Label>
                    <Input type="number" min={0} value={form.reviews_count} onChange={(e) => updateField('reviews_count', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.studentsCount', { defaultValue: 'Students' })}</Label>
                    <Input type="number" min={0} value={form.students_count} onChange={(e) => updateField('students_count', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.lessonsCount', { defaultValue: 'Lessons' })}</Label>
                    <Input type="number" min={0} value={form.lessons_count} onChange={(e) => updateField('lessons_count', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.bookedRecently', { defaultValue: 'Booked recently' })}</Label>
                    <Input type="number" min={0} value={form.booked_recently} onChange={(e) => updateField('booked_recently', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('staff.teacher.profile.responseTime', { defaultValue: 'Response time' })}</Label>
                    <Input value={form.response_time} onChange={(e) => updateField('response_time', e.target.value)} placeholder="1h" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      <span className="text-lg font-bold">{form.rating}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{form.reviews_count} {t('staff.teacher.profile.reviewsLabel', { defaultValue: 'reviews' })}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{form.lessons_count}</p>
                    <p className="text-xs text-muted-foreground">{t('staff.teacher.profile.lessonsLabel', { defaultValue: 'lessons' })}</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{form.students_count}</p>
                    <p className="text-xs text-muted-foreground">{t('staff.teacher.profile.studentsLabel', { defaultValue: 'students' })}</p>
                  </div>
                </div>
              )}

              {/* Badges display */}
              {form.badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  {form.badges.includes('professional') && (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {t('languages.teachers.professional', { defaultValue: 'Professional' })}
                    </Badge>
                  )}
                  {form.badges.includes('super') && (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      {t('languages.teachers.superTeacher', { defaultValue: 'Super Teacher' })}
                    </Badge>
                  )}
                </div>
              )}

              {/* Response time + booked recently */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {t('staff.teacher.profile.respondsIn', { defaultValue: 'Responds in {{time}}', time: form.response_time })}
                </span>
                {form.booked_recently > 0 && (
                  <span>{form.booked_recently} {t('staff.teacher.profile.bookedRecentlyLabel', { defaultValue: 'booked recently' })}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT SIDEBAR (Preply-style) ═══ */}
        <div className="space-y-4">
          {/* Price Card */}
          <Card className="border-primary/20">
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                {editSection === 'pricing' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('staff.teacher.profile.pricePerLesson', { defaultValue: 'Price per Lesson (USD)' })}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.price_per_lesson ?? ''}
                        onChange={(e) => updateField('price_per_lesson', e.target.value ? Number(e.target.value) : null)}
                        placeholder="45"
                        className="text-center text-lg font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('staff.teacher.profile.lessonDuration', { defaultValue: 'Lesson Duration (min)' })}</Label>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={form.lesson_duration_minutes}
                        onChange={(e) => updateField('lesson_duration_minutes', Number(e.target.value) || 50)}
                        placeholder="50"
                        className="text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-primary">
                      {form.price_per_lesson != null ? `$${form.price_per_lesson}` : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('staff.teacher.profile.perLesson', { defaultValue: 'per {{min}}-min lesson', min: form.lesson_duration_minutes })}
                    </p>
                  </>
                )}
              </div>
              <Button variant="ghost" size="sm" className="w-full gap-1" onClick={() => toggleEdit('pricing')}>
                <Pencil className="h-3 w-3" />
                {t('staff.teacher.profile.editPricing', { defaultValue: 'Edit Pricing' })}
              </Button>
            </CardContent>
          </Card>

          {/* Verification Status */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t('staff.teacher.profile.approval_status', { defaultValue: 'Teaching Approval' })}
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('staff.teacher.profile.status', { defaultValue: 'Status' })}
                </span>
                <Badge variant={profile.canTeach ? 'secondary' : 'outline'}>
                  {profile.canTeach
                    ? t('portal.teacherAccount.approved', { defaultValue: 'Approved' })
                    : t('portal.teacherAccount.pending', { defaultValue: 'Pending' })}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {t('staff.teacher.profile.documents_status', { defaultValue: 'Documents' })}
                </span>
                <Badge variant="outline">
                  {t('staff.teacher.profile.document_count', {
                    defaultValue: '{{count}} files',
                    count: profile.documents.length,
                  })}
                </Badge>
              </div>
              {!profile.canTeach && profile.blockers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.blockers.map((blocker) => (
                    <Badge key={blocker} variant="outline" className="text-xs">
                      {t(`portal.teacherAccount.blocker.${blocker}`, { defaultValue: blocker })}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Completeness */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">
                {t('staff.teacher.profile.completeness', { defaultValue: 'Profile Completeness' })}
              </h4>
              <ProfileCompleteness form={form} />
            </CardContent>
          </Card>

          {/* Save Button - sticky on sidebar */}
          <div className="sticky top-4">
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('staff.teacher.profile.saveProfile', { defaultValue: 'Save Profile' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Reusable section with inline edit ═══ */
function ProfileSection({
  icon, title, isEditing, onToggleEdit, preview, emptyText, children
}: {
  icon: React.ReactNode;
  title: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  preview: string | null;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            {title}
          </h4>
          <Button variant="ghost" size="icon" onClick={onToggleEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        {isEditing ? (
          <div>{children}</div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {preview || <span className="text-muted-foreground italic">{emptyText}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══ Profile completeness indicator ═══ */
function ProfileCompleteness({ form }: { form: PublicProfile }) {
  const { t } = useLanguage();
  const fields = [
    { key: 'display_name', filled: !!form.display_name },
    { key: 'bio', filled: !!form.bio },
    { key: 'teaching_experience', filled: !!form.teaching_experience },
    { key: 'education', filled: !!form.education },
    { key: 'specialty', filled: !!form.specialty },
    { key: 'languages', filled: form.languages_spoken.length > 0 },
    { key: 'country', filled: !!form.country },
    { key: 'price', filled: form.price_per_lesson != null },
  ];
  const filled = fields.filter(f => f.filled).length;
  const pct = Math.round((filled / fields.length) * 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{filled}/{fields.length}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {fields.filter(f => !f.filled).map(f => (
          <Badge key={f.key} variant="outline" className="text-xs">
            {t(`staff.teacher.profile.missing.${f.key}`, { defaultValue: f.key })}
          </Badge>
        ))}
      </div>
    </div>
  );
}
