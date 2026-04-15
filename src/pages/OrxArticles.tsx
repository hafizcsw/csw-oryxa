/**
 * ORX Articles Index — List of all ORX insight articles
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { ORX_ARTICLES } from '@/data/orxArticles';
import { Clock, Sparkles, ArrowRight } from 'lucide-react';

export default function OrxArticles() {
  const { t } = useTranslation();

  return (
    <Layout>
      <SEOHead
        title={t('orx.articles.seo.title')}
        description={t('orx.articles.seo.description')}
        canonical="/orx-rank/articles"
      />

      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">{t('orx.breadcrumb.home')}</Link>
          <span>/</span>
          <Link to="/orx-rank" className="hover:text-foreground transition-colors">{t('orx.brandName')}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{t('orx.articles.breadcrumb')}</span>
        </div>
      </div>

      {/* Header */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('orx.brandName')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-3">
            {t('orx.articles.hero.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('orx.articles.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="pb-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ORX_ARTICLES.map(article => (
              <Link
                key={article.slug}
                to={`/orx-rank/articles/${article.slug}`}
                className="group flex flex-col p-6 rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lg)] transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {t(`orx.categories.${article.category}`)}
                  </span>
                  {article.read_time_minutes && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {article.read_time_minutes} {t('orx.hub.insights.minRead')}
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-foreground group-hover:text-primary transition-colors mb-2 leading-snug flex-1">
                  {t(article.title_key)}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                  {t(article.excerpt_key)}
                </p>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  {t('orx.articles.readMore')} <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
