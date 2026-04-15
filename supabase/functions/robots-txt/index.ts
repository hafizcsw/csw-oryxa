const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const host = req.headers.get('host') || 'example.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const robotsTxt = `# Robots.txt for Connect Study World
User-agent: *

# Disallow search and filter pages
Disallow: /search
Disallow: /search?*
Disallow: /programs?*
Disallow: /universities?*
Disallow: /scholarships?*
Disallow: /*?page=*
Disallow: /*?filter=*
Disallow: /*?sort=*

# Disallow admin and account pages
Disallow: /admin
Disallow: /admin/*
Disallow: /account
Disallow: /account/*
Disallow: /auth
Disallow: /apply
Disallow: /status

# Allow main pages
Allow: /
Allow: /country/
Allow: /university/
Allow: /program/
Allow: /scholarship/

# Sitemaps
Sitemap: ${baseUrl}/sitemap/index.xml

# Crawl-delay (optional, for politeness)
Crawl-delay: 1

# Special rules for specific bots (optional)
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /
`;

  return new Response(robotsTxt, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
});
