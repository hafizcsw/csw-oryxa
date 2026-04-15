/**
 * ORX Article Detail — Individual article page with full body content
 */

import { useTranslation } from 'react-i18next';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { getArticleBySlug, ORX_ARTICLES } from '@/data/orxArticles';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft, ArrowRight } from 'lucide-react';

export default function OrxArticleDetail() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticleBySlug(slug) : undefined;

  if (!article) {
    return <Navigate to="/orx-rank/articles" replace />;
  }

  // Find adjacent articles for nav
  const currentIdx = ORX_ARTICLES.findIndex(a => a.slug === slug);
  const prevArticle = currentIdx > 0 ? ORX_ARTICLES[currentIdx - 1] : null;
  const nextArticle = currentIdx < ORX_ARTICLES.length - 1 ? ORX_ARTICLES[currentIdx + 1] : null;

  // Build sections from locale keys
  const sections: { heading: string; body: string }[] = [];
  for (let i = 0; i < article.sections_count; i++) {
    sections.push({
      heading: t(`${article.body_prefix}.sections.${i}.heading`),
      body: t(`${article.body_prefix}.sections.${i}.body`),
    });
  }

  return (
    <Layout>
      <SEOHead
        title={t(article.title_key)}
        description={t(article.excerpt_key)}
        canonical={`/orx-rank/articles/${slug}`}
      />

      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">{t('orx.breadcrumb.home')}</Link>
          <span>/</span>
          <Link to="/orx-rank" className="hover:text-foreground transition-colors">{t('orx.brandName')}</Link>
          <span>/</span>
          <Link to="/orx-rank/articles" className="hover:text-foreground transition-colors">{t('orx.articles.breadcrumb')}</Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{t(article.title_key)}</span>
        </div>
      </div>

      {/* Article */}
      <article className="py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-6">
            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
              {t(`orx.categories.${article.category}`)}
            </span>
            {article.read_time_minutes && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {article.read_time_minutes} {t('orx.hub.insights.minRead')}
              </span>
            )}
            {article.published_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(article.published_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-6 leading-[1.15]">
            {t(article.title_key)}
          </h1>

          {/* Excerpt */}
          <p className="text-lg text-muted-foreground leading-relaxed mb-10 border-s-4 border-primary/30 ps-4">
            {t(article.excerpt_key)}
          </p>

          {/* Body Sections */}
          <div className="space-y-10">
            {sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 leading-tight">
                  {section.heading}
                </h2>
                <div className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-12 pt-8 border-t border-border/50 flex items-center justify-between">
            {prevArticle ? (
              <Link to={`/orx-rank/articles/${prevArticle.slug}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="max-w-[200px] truncate">{t(prevArticle.title_key)}</span>
              </Link>
            ) : <div />}
            {nextArticle ? (
              <Link to={`/orx-rank/articles/${nextArticle.slug}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span className="max-w-[200px] truncate">{t(nextArticle.title_key)}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>

          {/* Back CTA */}
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/orx-rank/articles">
                <ArrowLeft className="w-4 h-4" /> {t('orx.articles.backToAll')}
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </Layout>
  );
}
