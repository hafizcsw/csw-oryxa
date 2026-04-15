import { useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useServiceRegions, usePaidServices, type PaidService } from '@/hooks/usePaidServices';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, BookOpen, GraduationCap, Users, Package, Check, Star,
  Loader2, ArrowRight, Shield, Clock, Headphones,
  MapPin, Sparkles, ChevronRight, ChevronDown, Zap, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ── Category metadata ── */
const CATEGORY_META: Record<string, { icon: typeof Globe; labelKey: string }> = {
  language_course: { icon: BookOpen, labelKey: 'services.categories.languages' },
  student_service: { icon: Users, labelKey: 'services.categories.studentServices' },
  admission: { icon: GraduationCap, labelKey: 'services.categories.admission' },
  bundle: { icon: Package, labelKey: 'services.categories.bundles' },
};

const CATEGORY_COLORS: Record<string, { icon: string; bg: string; badge: string }> = {
  language_course: { icon: 'text-blue-500', bg: 'bg-blue-500/10', badge: 'bg-blue-500/10 text-blue-600' },
  student_service: { icon: 'text-emerald-500', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/10 text-emerald-600' },
  admission: { icon: 'text-violet-500', bg: 'bg-violet-500/10', badge: 'bg-violet-500/10 text-violet-600' },
  bundle: { icon: 'text-amber-500', bg: 'bg-amber-500/10', badge: 'bg-amber-500/10 text-amber-600' },
};

const CATEGORIES = ['language_course', 'student_service', 'admission', 'bundle'] as const;

const REGION_ICONS: Record<string, string> = {
  russia: '🇷🇺', europe: '🇪🇺', asia: '🌏', africa: '🌍',
  north_america: '🌎', south_america: '🌎', oceania: '🌊',
};

/* ── Compact Row Card ── */
function ServiceRow({ service, t, isRtl, index }: { service: PaidService; t: (k: string) => string; isRtl: boolean; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const colors = CATEGORY_COLORS[service.category];
  const features = service.features || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        'group rounded-xl border transition-all duration-200 overflow-hidden',
        service.is_popular
          ? 'border-primary/40 bg-primary/[0.03] shadow-sm'
          : 'border-border bg-card hover:border-primary/20 hover:bg-muted/30'
      )}
    >
      {/* Main row - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-3 sm:p-4 text-start"
      >
        {/* Expand icon */}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', expanded && 'rotate-180')} />

        {/* Left: Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {service.is_popular && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                <Star className="w-3 h-3 fill-current" />
                {t('services.popular')}
              </span>
            )}
            {service.tier && (
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider', colors.badge)}>
                {service.tier}
              </span>
            )}
            <h3 className="text-sm font-bold text-foreground">{t(service.name_key)}</h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{t(service.description_key)}</p>
        </div>

        {/* Right: Price */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="text-end">
            <span className="text-lg sm:text-xl font-extrabold text-foreground">${service.price_usd}</span>
            <span className="text-[10px] text-muted-foreground ms-0.5">USD</span>
          </div>
        </div>
      </button>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
              {/* Full description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{t(service.description_key)}</p>

              {/* All features */}
              {features.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {features.map((featKey, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {t(featKey)}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className={cn('h-8 px-4 text-xs font-semibold gap-1', service.is_popular && 'shadow-sm shadow-primary/20')}
                  variant={service.is_popular ? 'default' : 'outline'}
                >
                  {t('services.orderNow')}
                  <ArrowRight className={cn('w-3 h-3', isRtl && 'rotate-180')} />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Trust Stats ── */
function TrustStats({ t }: { t: (k: string) => string }) {
  const stats = [
    { icon: Users, value: '15,000+', labelKey: 'services.stats.students' },
    { icon: Globe, value: '215+', labelKey: 'services.stats.countries' },
    { icon: GraduationCap, value: '500+', labelKey: 'services.stats.universities' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="text-center p-4 rounded-xl bg-card border border-border/50">
            <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
            <p className="text-xl font-extrabold text-foreground">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t(stat.labelKey)}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ── */
export default function PaidServicesPage() {
  const { t, language } = useLanguage();
  const isRtl = ['ar', 'fa', 'ur', 'he'].includes(language);

  const { data: regions, isLoading: regionsLoading } = useServiceRegions();
  const [selectedRegionSlug, setSelectedRegionSlug] = useState<string | null>(null);

  const activeRegion = useMemo(() => {
    if (!regions?.length) return null;
    if (selectedRegionSlug) return regions.find(r => r.slug === selectedRegionSlug) || regions[0];
    return regions[0];
  }, [regions, selectedRegionSlug]);

  const { data: services, isLoading: servicesLoading } = usePaidServices(activeRegion?.id || null);

  const grouped = useMemo(() => {
    if (!services) return {};
    const g: Record<string, PaidService[]> = {};
    for (const cat of CATEGORIES) {
      const items = services.filter(s => s.category === cat);
      if (items.length) g[cat] = items;
    }
    return g;
  }, [services]);

  if (regions?.length && !selectedRegionSlug) {
    setSelectedRegionSlug(regions[0].slug);
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* ═══ Hero ═══ */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.12),transparent_50%)]" />
          <div className="relative max-w-5xl mx-auto px-4 py-16 lg:py-20 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                {t('services.hero.badge')}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-foreground">
                {t('services.hero.title')}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('services.hero.subtitle')}
              </p>
            </motion.div>
          </div>
        </section>

        {/* ═══ Stats ═══ */}
        <section className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
          <TrustStats t={t} />
        </section>

        {/* ═══ Region Selector ═══ */}
        <section className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border mt-6">
          <div className="max-w-5xl mx-auto px-4 py-3">
            {regionsLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {regions?.map(region => {
                  const isActive = activeRegion?.slug === region.slug;
                  return (
                    <button
                      key={region.slug}
                      onClick={() => setSelectedRegionSlug(region.slug)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md scale-[1.03]'
                          : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span className="text-sm">{REGION_ICONS[region.slug] || '🌐'}</span>
                      {t(region.name_key)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ═══ Services ═══ */}
        <section className="max-w-5xl mx-auto px-4 py-10">
          {servicesLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('services.loading')}</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRegion?.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-10"
              >
                {CATEGORIES.map(cat => {
                  const items = grouped[cat];
                  if (!items?.length) return null;
                  const meta = CATEGORY_META[cat];
                  const colors = CATEGORY_COLORS[cat];
                  const Icon = meta.icon;

                  return (
                    <div key={cat}>
                      {/* Category header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors.bg)}>
                          <Icon className={cn('w-5 h-5', colors.icon)} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-foreground">{t(meta.labelKey)}</h2>
                          <p className="text-xs text-muted-foreground">{t(`services.categoryDesc.${cat}`)}</p>
                        </div>
                      </div>

                      {/* Service rows */}
                      <div className="space-y-2">
                        {items.map((service, i) => (
                          <ServiceRow key={service.id} service={service} t={t} isRtl={isRtl} index={i} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {Object.keys(grouped).length === 0 && (
                  <div className="text-center py-20">
                    <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">{t('services.noServices')}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {/* ═══ Trust + CTA ═══ */}
        <section className="border-t border-border bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              {[
                { icon: Shield, labelKey: 'services.trust.secure', color: 'text-emerald-500' },
                { icon: Clock, labelKey: 'services.trust.fast', color: 'text-blue-500' },
                { icon: Headphones, labelKey: 'services.trust.support', color: 'text-violet-500' },
                { icon: Zap, labelKey: 'services.trust.guarantee', color: 'text-amber-500' },
              ].map((badge, i) => {
                const BIcon = badge.icon;
                return (
                  <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/50 text-xs">
                    <BIcon className={cn('w-3.5 h-3.5', badge.color)} />
                    <span className="text-muted-foreground font-medium">{t(badge.labelKey)}</span>
                  </div>
                );
              })}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t('services.cta.title')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('services.cta.subtitle')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gap-2 h-11 px-6 font-semibold shadow-md shadow-primary/20">
                {t('services.cta.getStarted')}
                <ArrowRight className={cn('w-4 h-4', isRtl && 'rotate-180')} />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 h-11 px-6 font-semibold">
                <Headphones className="w-4 h-4" />
                {t('services.cta.contactUs')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
