import { Helmet } from "react-helmet";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  index?: boolean;
  ogType?: "website" | "article";
  ogImage?: string;
  jsonLd?: object | object[];
  hreflang?: Array<{ lang: string; url: string }>;
}

export function SEOHead({
  title,
  description,
  canonical,
  index = true,
  ogType = "website",
  ogImage,
  jsonLd,
  hreflang,
}: SEOHeadProps) {
  const siteUrl = window.location.origin;
  const currentUrl = canonical || window.location.href;
  const defaultImage = `${siteUrl}/placeholder.svg`;
  const finalOgImage = ogImage || defaultImage;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      
      {/* Canonical */}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Robots */}
      <meta 
        name="robots" 
        content={index ? "index, follow" : "noindex, nofollow"} 
      />
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={finalOgImage} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={finalOgImage} />
      
      {/* Hreflang */}
      {hreflang?.map(({ lang, url }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}
      
      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  );
}
