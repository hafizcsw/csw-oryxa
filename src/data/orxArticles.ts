/**
 * ORX Articles — Structured content model
 * 
 * This serves as a local content source that can be migrated to CMS later.
 * All text uses i18n keys, no hardcoded strings.
 */

import type { OrxArticle } from '@/types/orx';

export const ORX_ARTICLES: OrxArticle[] = [
  {
    slug: 'what-is-orx-rank',
    title_key: 'orx.articles.whatIsOrx.title',
    excerpt_key: 'orx.articles.whatIsOrx.excerpt',
    body_prefix: 'orx.articles.whatIsOrx',
    sections_count: 6,
    category: 'methodology',
    published_at: '2026-03-01',
    read_time_minutes: 8,
  },
  {
    slug: 'why-future-readiness-matters',
    title_key: 'orx.articles.futureReadiness.title',
    excerpt_key: 'orx.articles.futureReadiness.excerpt',
    body_prefix: 'orx.articles.futureReadiness',
    sections_count: 5,
    category: 'insights',
    published_at: '2026-03-05',
    read_time_minutes: 6,
  },
  {
    slug: 'best-countries-ai-education',
    title_key: 'orx.articles.bestCountriesAi.title',
    excerpt_key: 'orx.articles.bestCountriesAi.excerpt',
    body_prefix: 'orx.articles.bestCountriesAi',
    sections_count: 5,
    category: 'country',
    published_at: '2026-03-08',
    read_time_minutes: 10,
  },
  {
    slug: 'universities-adapting-fastest',
    title_key: 'orx.articles.universitiesAdapting.title',
    excerpt_key: 'orx.articles.universitiesAdapting.excerpt',
    body_prefix: 'orx.articles.universitiesAdapting',
    sections_count: 5,
    category: 'university',
    published_at: '2026-03-10',
    read_time_minutes: 7,
  },
  {
    slug: 'strongest-programs-next-decade',
    title_key: 'orx.articles.strongestPrograms.title',
    excerpt_key: 'orx.articles.strongestPrograms.excerpt',
    body_prefix: 'orx.articles.strongestPrograms',
    sections_count: 5,
    category: 'program',
    published_at: '2026-03-12',
    read_time_minutes: 9,
  },
  {
    slug: 'ai-reshaping-higher-education',
    title_key: 'orx.articles.aiReshaping.title',
    excerpt_key: 'orx.articles.aiReshaping.excerpt',
    body_prefix: 'orx.articles.aiReshaping',
    sections_count: 5,
    category: 'future_jobs',
    published_at: '2026-03-13',
    read_time_minutes: 5,
  },
  {
    slug: 'traditional-rankings-miss-signals',
    title_key: 'orx.articles.traditionalMiss.title',
    excerpt_key: 'orx.articles.traditionalMiss.excerpt',
    body_prefix: 'orx.articles.traditionalMiss',
    sections_count: 5,
    category: 'insights',
    published_at: '2026-02-28',
    read_time_minutes: 7,
  },
];

export function getArticleBySlug(slug: string): OrxArticle | undefined {
  return ORX_ARTICLES.find(a => a.slug === slug);
}

export function getArticlesByCategory(category: OrxArticle['category']): OrxArticle[] {
  return ORX_ARTICLES.filter(a => a.category === category);
}
