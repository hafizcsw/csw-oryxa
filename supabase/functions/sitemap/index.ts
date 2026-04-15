import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const BASE_URL = Deno.env.get('PUBLIC_BASE_URL') || 'https://bmditidkhlbszhvkrnau.supabase.co';

// Simple in-memory cache
let cachedSitemap: string | null = null;
let cacheTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

serve(async (req) => {
  try {
    const now = Date.now();
    
    // Return cached sitemap if still valid
    if (cachedSitemap && (now - cacheTime) < CACHE_DURATION) {
      return new Response(cachedSitemap, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=600',
        },
      });
    }

    const supabase = getSupabaseAdmin();

    // Fetch countries
    const { data: countries } = await supabase
      .from('countries')
      .select('slug, lastmod')
      .order('name');

    // Fetch top programs (limit 2000 for sitemap size)
    const { data: programs } = await supabase
      .from('programs_view')
      .select('program_id')
      .order('ranking')
      .limit(2000);

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/search', priority: '0.9', changefreq: 'daily' },
      { url: '/apply', priority: '0.8', changefreq: 'weekly' },
    ];

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Country pages
    if (countries) {
      for (const country of countries) {
        const lastmod = country.lastmod || new Date().toISOString();
        xml += `  <url>\n`;
        xml += `    <loc>${BASE_URL}/country/${country.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod.split('T')[0]}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    // Program pages
    if (programs) {
      for (const program of programs) {
        xml += `  <url>\n`;
        xml += `    <loc>${BASE_URL}/p/${program.program_id}</loc>\n`;
        xml += `    <changefreq>monthly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += '</urlset>';

    // Cache the result
    cachedSitemap = xml;
    cacheTime = now;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    console.error('Sitemap error:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
});
