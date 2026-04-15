/**
 * #7.3 Shortlist Dropdown Panel
 * Grid layout: Continent header → Countries as cards in 3-col grid → Universities & Programs under each
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, BarChart3, GraduationCap, MapPin, Loader2, User, Building2, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShortlist } from '@/hooks/useShortlist';
import { useUniversityShortlistHook } from '@/hooks/useUniversityShortlist';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getContinent, getContinentName } from '@/lib/continentMapping';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgramCardCompact } from '@/components/ProgramCardCompact';

interface ShortlistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_SHORTLIST = 10;

export function ShortlistDrawer({ open, onOpenChange }: ShortlistDrawerProps) {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { shortlist, loading, refetch } = useShortlist();
  const { items: uniItems, isLoading: uniLoading } = useUniversityShortlistHook();
  const [session, setSession] = useState<any>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAr = language === 'ar';
  const localePrefix = isAr ? 'ar' : 'en';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const isAuthenticated = !!session?.access_token;
  const programCount = shortlist?.length ?? 0;
  const uniCount = uniItems?.length ?? 0;
  const totalCount = programCount + uniCount;

  useEffect(() => { if (open && isAuthenticated) refetch(); }, [open, isAuthenticated, refetch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const trigger = document.querySelector('[data-shortlist-target]');
        if (trigger && trigger.contains(e.target as Node)) return;
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const getName = (item: any, field: string) =>
    item?.[`${field}_${language}`] || item?.[`${field}_en`] || item?.[`${field}_ar`] || item?.[field] || '';

  // Fetch university details for uni-only favorites
  const uniIds = useMemo(() => uniItems.map(u => u.university_id), [uniItems]);
  const { data: uniDetails } = useQuery({
    queryKey: ['shortlist-drawer-uni', ...uniIds],
    queryFn: async () => {
      if (!uniIds.length) return {};
      const { data } = await supabase
        .from('universities')
        .select('id, name, name_ar, name_en, country_code, city, logo_url')
        .in('id', uniIds);
      const map: Record<string, any> = {};
      (data || []).forEach((u: any) => { map[u.id] = u; });
      return map;
    },
    enabled: uniIds.length > 0 && open,
    staleTime: 60_000,
  });

  // Fetch program details for inline display in heart dropdown
  const programIds = useMemo(
    () => (shortlist || []).map((item: any) => item.program_id || item.program_ref_id).filter(Boolean),
    [shortlist]
  );

  const { data: programDetails, isLoading: programDetailsLoading } = useQuery({
    queryKey: ['shortlist-drawer-programs', ...programIds],
    queryFn: async () => {
      if (!programIds.length) return {};

      const { data } = await supabase
        .from('vw_program_search_api_v3_final')
        .select('program_id, degree_name, duration_months, tuition_usd_year_max, currency_code, instruction_languages, program_name_ar, program_name_en, discipline_name_ar, discipline_name_en')
        .in('program_id', programIds);

      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => {
        if (p?.program_id) map[p.program_id] = p;
      });
      return map;
    },
    enabled: programIds.length > 0 && open,
    staleTime: 60_000,
  });

  // Build hierarchy: continent → country → university → programs
  const hierarchy = useMemo(() => {
    type UniNode = { id: string; name: string; name_ar?: string; name_en?: string; logo_url?: string; programs: any[]; isFavUni: boolean };
    type CountryNode = { code: string; name: string; universities: Record<string, UniNode> };
    type ContinentNode = { key: string; name: string; countries: Record<string, CountryNode> };

    const tree: Record<string, ContinentNode> = {};

    const ensureContinent = (cc: string) => {
      const continent = getContinent(cc);
      if (!tree[continent]) {
        tree[continent] = { key: continent, name: getContinentName(continent, language), countries: {} };
      }
      return continent;
    };

    // Programs
    for (const item of (shortlist || [])) {
      const programId = item.program_id || item.program_ref_id;
      const details = programDetails?.[programId];
      const snap = item?.snapshot || {};
      const cc = (item.country_code || item.country_slug || getName(snap, 'country_code') || '').toUpperCase();
      const continent = ensureContinent(cc);
      const countryKey = cc || 'XX';
      const countryName = getName(item, 'country_name') || getName(snap, 'country_name') || cc || (isAr ? 'غير محدد' : 'Unknown');
      const uniName = getName(item, 'university_name') || getName(snap, 'university_name') || (isAr ? 'جامعة' : 'University');
      const uniKey = item.university_id || getName(snap, 'university_id') || uniName;

      if (!tree[continent].countries[countryKey]) {
        tree[continent].countries[countryKey] = { code: cc, name: countryName, universities: {} };
      }
      if (!tree[continent].countries[countryKey].universities[uniKey]) {
        tree[continent].countries[countryKey].universities[uniKey] = {
          id: uniKey, name: uniName,
          name_ar: item.university_name_ar || snap.university_name_ar,
          name_en: item.university_name_en || snap.university_name_en,
          logo_url: item.logo_url || snap.university_logo || snap.logo_url,
          programs: [], isFavUni: false,
        };
      }
      tree[continent].countries[countryKey].universities[uniKey].programs.push({
        program_id: programId,
        program_name: getName(item, 'program_name') || getName(snap, 'program_name') || (isAr ? details?.program_name_ar : details?.program_name_en),
        program_name_ar: item.program_name_ar || snap.program_name_ar || details?.program_name_ar,
        program_name_en: item.program_name_en || snap.program_name_en || details?.program_name_en,
        fees_yearly: item.fees_yearly || item.tuition_usd_year_max || snap.tuition_usd_max || snap.fees_yearly || details?.tuition_usd_year_max,
        currency_code: item.currency_code || snap.currency_code || details?.currency_code || 'USD',
        degree_name: getName(item, 'degree_name') || snap.degree_level || item?.degree_slug || snap.degree_slug || details?.degree_name,
        duration_months: item.duration_months || snap.duration_months || details?.duration_months,
        duration: item.duration || snap.duration || item?.duration_years || snap.duration_years,
        discipline_name_ar: details?.discipline_name_ar,
        discipline_name_en: details?.discipline_name_en,
        language: item.language || snap.language || details?.instruction_languages?.[0],
        city: item.city || snap.city,
      });
    }

    // University-only favorites
    for (const uni of uniItems) {
      const uniData = uniDetails?.[uni.university_id];
      const cc = (uniData?.country_code || '').toUpperCase();
      const continent = ensureContinent(cc);
      const countryKey = cc || 'XX';

      if (!tree[continent].countries[countryKey]) {
        tree[continent].countries[countryKey] = {
          code: cc,
          name: cc || (isAr ? 'غير محدد' : 'Unknown'),
          universities: {},
        };
      }

      if (tree[continent].countries[countryKey].universities[uni.university_id]) {
        tree[continent].countries[countryKey].universities[uni.university_id].isFavUni = true;
      } else {
        const resolvedName = uniData
          ? (isAr ? (uniData.name_ar || uniData.name) : (uniData.name_en || uniData.name))
          : (isAr ? 'جامعة مفضلة' : 'Favorited University');
        tree[continent].countries[countryKey].universities[uni.university_id] = {
          id: uni.university_id, name: resolvedName,
          logo_url: uniData?.logo_url,
          programs: [], isFavUni: true,
        };
      }
    }

    return Object.values(tree).filter(c => Object.keys(c.countries).length > 0);
  }, [shortlist, uniItems, uniDetails, programDetails, language]);

  const handleNav = (path: string) => { onOpenChange(false); navigate(path); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            onClick={() => onOpenChange(false)}
          />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scaleY: 0.97 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.97 }}
            transition={{ duration: 0.25, ease: [0.32, 0, 0.15, 1] }}
            className="fixed left-0 right-0 z-50 mx-auto max-w-5xl px-4"
            style={{ top: '72px' }}
          >
            <div className="bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <Heart className="w-4.5 h-4.5 text-destructive fill-destructive" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{isAr ? 'المفضلة' : 'Favorites'}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {totalCount} {isAr ? 'من' : 'of'} {MAX_SHORTLIST}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={totalCount >= MAX_SHORTLIST ? "destructive" : "secondary"}
                    className="text-xs font-bold px-2.5"
                  >
                    {totalCount}/{MAX_SHORTLIST}
                  </Badge>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
                {!isAuthenticated ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Heart className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      {isAr ? 'سجل دخولك لحفظ البرامج والجامعات' : 'Log in to save programs and universities'}
                    </p>
                    <Button size="sm" onClick={() => { sessionStorage.setItem('post_auth_return_to', window.location.pathname); navigate('/auth'); }}>
                      {isAr ? 'تسجيل الدخول' : 'Log in'}
                    </Button>
                  </div>
                ) : (loading || uniLoading || programDetailsLoading) ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  </div>
                ) : totalCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Heart className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isAr ? 'لا توجد عناصر في المفضلة بعد' : 'No favorites yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {hierarchy.map((cont) => {
                      const countries = Object.values(cont.countries);
                      return (
                        <div key={cont.key}>
                          {/* Continent header */}
                          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/40">
                            <Globe className="h-4 w-4 text-primary" />
                            <span className="text-xs font-bold text-foreground uppercase tracking-wide">{cont.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 h-4 ms-auto">
                              {countries.length} {isAr ? (countries.length > 2 ? 'دول' : 'دولة') : (countries.length === 1 ? 'country' : 'countries')}
                            </Badge>
                          </div>

                          {/* Countries grid — 3 columns */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {countries.map((country) => {
                              const unis = Object.values(country.universities);
                              return (
                                <div
                                  key={country.code}
                                  className="rounded-xl border border-border/50 bg-muted/15 overflow-hidden"
                                >
                                  {/* Country header */}
                                  <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b border-border/30">
                                    <MapPin className="h-3.5 w-3.5 text-primary/70" />
                                    <span className="text-[11px] font-bold text-foreground">{country.name}</span>
                                  </div>

                                  {/* Universities & programs stacked vertically */}
                                  <div className="p-2 space-y-2">
                                    {unis.map((uni) => (
                                      <div key={uni.id} className="space-y-1">
                                        {/* University */}
                                        <div
                                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                                          onClick={() => handleNav(`/${localePrefix}/university/${uni.id}`)}
                                        >
                                          {uni.logo_url ? (
                                            <img src={uni.logo_url} alt="" className="w-6 h-6 rounded-md object-contain bg-background border border-border/40 p-0.5 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                              <Building2 className="w-3 h-3 text-primary" />
                                            </div>
                                          )}
                                          <span className="text-[11px] font-semibold text-foreground truncate flex-1">{uni.name}</span>
                                          {uni.isFavUni && <Heart className="h-2.5 w-2.5 fill-destructive text-destructive shrink-0" />}
                                          {uni.programs.length > 0 && (
                                            <Badge variant="secondary" className="text-[8px] px-1 h-3.5 shrink-0">
                                              {uni.programs.length}
                                            </Badge>
                                          )}
                                        </div>

                                        {/* Programs */}
                                        {uni.programs.length > 0 ? (
                                          <div className="ps-2 space-y-2">
                                            {uni.programs.map((prog: any) => (
                                              <ProgramCardCompact
                                                key={prog.program_id}
                                                program={{
                                                  program_id: prog.program_id,
                                                  program_name: prog.program_name,
                                                  program_name_ar: prog.program_name_ar,
                                                  program_name_en: prog.program_name_en,
                                                  university_name: uni.name,
                                                  university_name_ar: uni.name_ar,
                                                  university_name_en: uni.name_en,
                                                  university_logo_url: uni.logo_url,
                                                  country_name: country.name,
                                                  fees_yearly: prog.fees_yearly,
                                                  currency_code: prog.currency_code,
                                                  duration_months: prog.duration_months,
                                                  degree_name: prog.degree_name,
                                                  degree_level: prog.degree_name,
                                                  discipline_name_ar: prog.discipline_name_ar,
                                                  discipline_name_en: prog.discipline_name_en,
                                                }}
                                                onDetails={(id) => handleNav(`/account?tab=shortlist`)}
                                                showHeart
                                              />
                                            ))}
                                          </div>
                                        ) : (
                                          <div
                                            className="ps-2 flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-dashed border-primary/30 text-primary text-[11px] font-medium cursor-pointer hover:bg-primary/5 transition-colors"
                                            onClick={() => handleNav(`/${localePrefix}/university/${uni.id}`)}
                                          >
                                            <GraduationCap className="h-3.5 w-3.5" />
                                            {isAr ? 'تصفح البرامج المتاحة' : 'Browse programs'}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {isAuthenticated && totalCount > 0 && (
                <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center gap-2">
                  {programCount >= 2 && (
                    <Button
                      onClick={() => handleNav('/compare')}
                      size="sm"
                      className="flex-1 gap-1.5 h-9 text-xs bg-gradient-to-r from-primary to-primary/80"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      {isAr ? `قارن ${programCount} برامج` : `Compare ${programCount}`}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleNav('/account?tab=shortlist')}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 h-9 text-xs"
                  >
                    <User className="w-3.5 h-3.5" />
                    {isAr ? 'الحساب الشخصي' : 'My Account'}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
