/**
 * ORX Countries Overview — Country-level ORX analysis
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Sparkles, Globe, ArrowRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrxCountries() {
  const { t } = useTranslation();

  return (
    <Layout>
      <SEOHead
        title={t('orx.countries.seo.title')}
        description={t('orx.countries.seo.description')}
        canonical="/orx-rank/countries"
      />

      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">{t('orx.breadcrumb.home')}</Link>
          <span>/</span>
          <Link to="/orx-rank" className="hover:text-foreground transition-colors">{t('orx.brandName')}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{t('orx.countries.breadcrumb')}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('orx.brandName')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-3">
            {t('orx.countries.hero.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {t('orx.countries.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* Coming soon state */}
      <section className="pb-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="p-12 rounded-2xl bg-muted/30 border border-border/50 text-center">
            <Globe className="w-12 h-12 text-primary/40 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">{t('orx.countries.comingSoon.title')}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {t('orx.countries.comingSoon.description')}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="gap-2">
                <Link to="/countries">{t('orx.countries.comingSoon.exploreCountries')} <ArrowRight className="w-4 h-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/orx-rank">{t('orx.countries.comingSoon.backToHub')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
