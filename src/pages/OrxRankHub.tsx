/**
 * ORX RANK Hub — Flagship landing page
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, TrendingUp, Brain, Globe, Zap, Shield, Eye, Users, 
  ArrowRight, ChevronRight, BookOpen, GraduationCap, MapPin, Clock,
  Target, Layers, BarChart3, MessageCircle
} from 'lucide-react';
import { ORX_ARTICLES } from '@/data/orxArticles';
import { cn } from '@/lib/utils';

export default function OrxRankHub() {
  const { t } = useTranslation();

  const measures = [
    { icon: TrendingUp, key: 'futureRelevance' },
    { icon: BookOpen, key: 'curriculumFreshness' },
    { icon: Brain, key: 'aiIntegration' },
    { icon: Zap, key: 'industryConnection' },
    { icon: Target, key: 'adaptationSpeed' },
    { icon: Layers, key: 'skillTransferability' },
    { icon: Eye, key: 'transparency' },
    { icon: Users, key: 'studentSignals' },
  ];

  const layers = [
    { icon: Globe, key: 'country' },
    { icon: GraduationCap, key: 'university' },
    { icon: BookOpen, key: 'program' },
  ];

  const faqs = [
    'whatIsOrx', 'isOfficial', 'differentFromQs', 'ranksOnlyUniversities',
    'ranksPrograms', 'basedOnlyAi', 'howOftenUpdated', 'canImprove'
  ];

  return (
    <Layout>
      <SEOHead
        title={t('orx.hub.seo.title')}
        description={t('orx.hub.seo.description')}
        canonical="/orx-rank"
      />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div className="absolute inset-0 opacity-20" style={{ background: 'var(--gradient-mesh)' }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            {t('orx.hub.hero.badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6">
            {t('orx.hub.hero.title')}
          </h1>
          <p className="text-lg sm:text-xl text-secondary-foreground/70 max-w-2xl mx-auto leading-relaxed mb-10">
            {t('orx.hub.hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 text-base font-bold px-8">
              <Link to="/universities?tab=universities">
                {t('orx.hub.hero.cta.explore')} <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 text-base border-white/40 text-white bg-white/10 hover:bg-white/20 hover:border-white/60">
              <Link to="/orx-rank/methodology">
                {t('orx.hub.hero.cta.methodology')}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="gap-2 text-base text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10">
              <Link to="/orx-rank/articles">
                {t('orx.hub.hero.cta.insights')} <BookOpen className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ WHY ORX EXISTS ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.why.label')}</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-6">{t('orx.hub.why.title')}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">{t('orx.hub.why.p1')}</p>
            <p className="text-lg text-muted-foreground leading-relaxed">{t('orx.hub.why.p2')}</p>
          </div>
        </div>
      </section>

      {/* ═══ WHAT ORX MEASURES ═══ */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.measures.label')}</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">{t('orx.hub.measures.title')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {measures.map(({ icon: Icon, key }) => (
              <div key={key} className="group p-6 rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lg)] transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1.5">{t(`orx.hub.measures.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.hub.measures.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ORX LAYERS ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.layers.label')}</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">{t('orx.hub.layers.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {layers.map(({ icon: Icon, key }, i) => (
              <div key={key} className="relative p-8 rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)] text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-black">
                  {i + 1}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <Icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{t(`orx.hub.layers.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.hub.layers.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY THIS MATTERS ═══ */}
      <section className="py-20 sm:py-28 bg-secondary text-secondary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.matters.label')}</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6">{t('orx.hub.matters.title')}</h2>
          <p className="text-lg text-secondary-foreground/70 leading-relaxed max-w-2xl mx-auto mb-8">
            {t('orx.hub.matters.description')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {['capability', 'adaptability', 'opportunity'].map(key => (
              <div key={key} className="p-5 rounded-xl border border-secondary-foreground/10 bg-secondary-foreground/5">
                <p className="text-2xl font-black text-primary mb-1">{t(`orx.hub.matters.${key}.stat`)}</p>
                <p className="text-xs text-secondary-foreground/60">{t(`orx.hub.matters.${key}.label`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ METHODOLOGY PREVIEW ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-start gap-10">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.methodology.label')}</span>
              <h2 className="text-3xl font-black tracking-tight text-foreground mb-4">{t('orx.hub.methodology.title')}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{t('orx.hub.methodology.p1')}</p>
              <p className="text-muted-foreground leading-relaxed mb-6">{t('orx.hub.methodology.p2')}</p>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/orx-rank/methodology">
                  {t('orx.hub.methodology.cta')} <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
            <div className="w-full md:w-80 shrink-0 p-6 rounded-2xl bg-muted/30 border border-border/50">
              <BarChart3 className="w-8 h-8 text-primary mb-4" />
              <div className="space-y-3">
                {['data', 'analysis', 'scoring', 'validation'].map(step => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">{t(`orx.hub.methodology.steps.${step}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ARTICLES / INSIGHTS ═══ */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">{t('orx.hub.insights.label')}</span>
              <h2 className="text-3xl font-black tracking-tight text-foreground">{t('orx.hub.insights.title')}</h2>
            </div>
            <Link to="/orx-rank/articles" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              {t('orx.hub.insights.viewAll')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ORX_ARTICLES.slice(0, 6).map(article => (
              <Link
                key={article.slug}
                to={`/orx-rank/articles/${article.slug}`}
                className="group p-5 rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lg)] transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {t(`orx.categories.${article.category}`)}
                  </span>
                  {article.read_time_minutes && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {article.read_time_minutes} {t('orx.hub.insights.minRead')}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-2 leading-snug">
                  {t(article.title_key)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {t(article.excerpt_key)}
                </p>
              </Link>
            ))}
          </div>
          <div className="sm:hidden mt-6 text-center">
            <Link to="/orx-rank/articles" className="text-sm font-semibold text-primary">
              {t('orx.hub.insights.viewAll')} →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-black tracking-tight text-foreground text-center mb-12">{t('orx.hub.faq.title')}</h2>
          <div className="space-y-4">
            {faqs.map(key => (
              <details key={key} className="group rounded-xl border border-border/50 bg-card overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-5 font-semibold text-foreground hover:text-primary transition-colors">
                  {t(`orx.hub.faq.${key}.q`)}
                  <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {t(`orx.hub.faq.${key}.a`)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-20 sm:py-28 bg-secondary text-secondary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">{t('orx.hub.finalCta.title')}</h2>
          <p className="text-lg text-secondary-foreground/70 max-w-xl mx-auto mb-8">
            {t('orx.hub.finalCta.description')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 text-base font-bold px-8">
              <Link to="/universities?tab=universities">
                {t('orx.hub.finalCta.explore')} <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 text-base border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10">
              <Link to="/for-institutions">
                {t('orx.hub.finalCta.claim')}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="gap-2 text-base text-secondary-foreground/80 hover:text-secondary-foreground">
              <Link to="/orx-rank/methodology">
                {t('orx.hub.finalCta.howItWorks')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
