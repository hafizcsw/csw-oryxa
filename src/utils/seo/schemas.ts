interface UniversityData {
  id: string;
  name: string;
  logo_url?: string;
  city?: string;
  country_name?: string;
  country_code?: string;
  website_url?: string;
  founded_year?: number;
}

interface ProgramData {
  id: string;
  title: string;
  description?: string;
  degree_level?: string;
  duration_months?: number;
  language?: string;
  tuition_fee?: number;
  currency?: string;
  university: {
    name: string;
    website?: string;
  };
  start_date?: string;
}

interface ScholarshipData {
  id: string;
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  provider_name: string;
  application_start?: string;
  application_deadline?: string;
  url?: string;
}

export function generateUniversitySchema(data: UniversityData, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    "@id": canonical,
    "name": data.name,
    "url": canonical,
    ...(data.logo_url && { "logo": data.logo_url }),
    ...(data.website_url && { "sameAs": [data.website_url] }),
    ...(data.founded_year && { "foundingDate": data.founded_year.toString() }),
    ...(data.city && data.country_code && {
      "address": {
        "@type": "PostalAddress",
        "addressCountry": data.country_code,
        "addressLocality": data.city,
      }
    }),
  };
}

export function generateProgramSchema(data: ProgramData, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": canonical,
    "name": data.title,
    ...(data.description && { "description": data.description }),
    "provider": {
      "@type": "CollegeOrUniversity",
      "name": data.university.name,
      ...(data.university.website && { "sameAs": data.university.website }),
    },
    ...(data.degree_level && { "educationalCredentialAwarded": data.degree_level }),
    ...(data.duration_months && { "timeRequired": `PT${data.duration_months}M` }),
    ...(data.language && { "inLanguage": data.language }),
    ...(data.tuition_fee && data.currency && {
      "offers": {
        "@type": "Offer",
        "priceCurrency": data.currency,
        "price": data.tuition_fee.toString(),
        "url": canonical,
        ...(data.start_date && { "availabilityStarts": data.start_date }),
      }
    }),
  };
}

export function generateScholarshipSchema(data: ScholarshipData, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Scholarship",
    "@id": canonical,
    "name": data.title,
    ...(data.description && { "description": data.description }),
    "provider": {
      "@type": "Organization",
      "name": data.provider_name,
    },
    ...(data.amount && data.currency && {
      "amount": {
        "@type": "MonetaryAmount",
        "currency": data.currency,
        "value": data.amount.toString(),
      }
    }),
    ...(data.application_start && { "applicationStartDate": data.application_start }),
    ...(data.application_deadline && { "applicationDeadline": data.application_deadline }),
    ...(data.url && { "url": data.url }),
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url,
    })),
  };
}

export function generateWebsiteSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": siteUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}/search?q={query}`,
      "query-input": "required name=query",
    },
  };
}

export function generateOrganizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Connect Study World",
    "url": siteUrl,
    "logo": `${siteUrl}/logo-connect-study-world.png`,
    "sameAs": [
      // Add social media profiles here
    ],
  };
}
