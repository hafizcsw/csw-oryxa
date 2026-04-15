# Country-Agnostic Harvest System 🌍

## Overview

The harvest system is now **fully country-agnostic**, capable of discovering and extracting university data from any country with automatic language detection, currency matching, and academic year tracking.

## Architecture

### 1. Country Profiles (`_shared/country-profiles.ts`)

Each country has a profile defining:
- **Code**: ISO country code (GB, US, SA, etc.)
- **Locales**: Supported languages (en, ar, de, fr, etc.)
- **Currency**: Local currency (GBP, USD, SAR, EUR, etc.)
- **Academic Year Start**: Typical start month (9 for September, etc.)
- **Terminology**: Fee terms, admission terms, scholarship terms in local language

**Currently Supported Countries:**
- 🇬🇧 United Kingdom (GB)
- 🇺🇸 United States (US)
- 🇨🇦 Canada (CA)
- 🇦🇺 Australia (AU)
- 🇩🇪 Germany (DE)
- 🇫🇷 France (FR)
- 🇳🇱 Netherlands (NL)
- 🇮🇹 Italy (IT)
- 🇪🇸 Spain (ES)
- 🇷🇺 Russia (RU)
- 🇹🇷 Turkey (TR)
- 🇸🇦 Saudi Arabia (SA)
- 🇦🇊 UAE (AE)
- 🇪🇬 Egypt (EG)
- 🇮🇳 India (IN)

### 2. Extraction Utilities (`_shared/extract-utils.ts`)

Provides:
- **eTLD+1 normalization**: `www.lse.ac.uk` → `lse.ac.uk`
- **Sitemap parsing**: Automatic sitemap discovery
- **Anchor collection**: Extract links from HTML
- **Dynamic rendering**: Firecrawl integration for JS-heavy sites
- **Currency detection**: Pattern matching for local currencies
- **Academic year parsing**: Detect 2024/2025 patterns

### 3. Official Page Finder (`_shared/find-official-pages.ts`)

Smart algorithm to find fee and admission pages:
1. **Collect links** from sitemap + home page anchors
2. **Filter** to same-site links only
3. **Match** against country-specific terminology
4. **Verify** content has currency + numbers for fees
5. **Render** dynamic pages if content is too small
6. **Return** best matches with evidence

### 4. Database Schema

#### New Fields

**harvest_results:**
- `page_lang`: Detected language (en, ar, de, etc.)
- `currency_detected`: Found currency (GBP, USD, etc.)
- `academic_year_detected`: Found academic year (2024/2025)
- `fee_evidence`: JSON evidence snippets

**program_draft:**
- `country_code`: ISO country code
- `currency_code`: Currency used
- `fee_as_of_year`: Academic year for fees
- `fee_captured_at`: Timestamp of fee capture
- `fee_content_hash`: Hash for change detection

**source_evidence (NEW):**
- Tracks source URLs for all extracted data
- Links to programs with field-level granularity
- Stores snippets, academic year, language

## How It Works

### Discovery Flow

```
1. User selects country → Get country profile
                          ↓
2. Discover candidates ← Wikipedia/Local sources
                          ↓
3. For each university:
   - Get home URL
   - Collect links (sitemap + anchors)
   - Filter same-site links
   - Match fee/admission terms (localized)
   - Verify content (currency + numbers)
   - Render if needed (dynamic pages)
                          ↓
4. Store results with:
   - Fee URLs
   - Admission URLs
   - Language detected
   - Currency detected
   - Academic year
   - Reason if not qualified
```

### Processing Pipeline

```
discover-country → Creates job
                   ↓
                   Finds candidates
                   ↓
                   Triggers process (async)
                   ↓
                   Returns immediately
                   
discover-process → Gets job + profile
                   ↓
                   For each candidate:
                   - Find official pages
                   - Extract data
                   - Store evidence
                   ↓
                   Updates job status
```

## UI Features

### Harvest Jobs Table

Shows:
- Country
- Status (discovering → processing → done)
- Processed count
- Qualified count
- Programs extracted
- Start time

### Results Table

Shows for each university:
- Name
- Domain
- Has official fees? (Yes/No)
- Fee URLs (clickable)
- Admission URLs (clickable)
- **Language** detected
- **Currency** detected
- **Academic year** detected
- **Reason** if not qualified
- Confidence score

### Rejection Reasons

- `no_firecrawl_key`: Firecrawl API key not configured
- `crawl_failed`: Website crawling failed
- `no_pages_crawled`: No pages found
- `no_pages_on_domain`: Links found but not on same domain
- `no_fee_page_found`: No page with fees + currency
- `no_admissions_page`: Admissions page not found
- `error:...`: Technical error occurred

## Testing

### Quick Test

1. Go to Admin → Ingestion → Bot
2. Select a country (try UK or Saudi Arabia)
3. Click "بدء الحصاد الذكي"
4. Watch the job progress
5. View results with links, currency, language

### Expected Results

**UK Universities:**
- Fee pages: `/fees-and-funding`, `/tuition-fees`
- Currency: GBP (£)
- Language: EN
- Academic year: 2024/2025

**Saudi Universities:**
- Fee pages: `/الرسوم-الدراسية`, `/fees`
- Currency: SAR (ريال)
- Language: AR or EN
- Academic year: 2024/2025

## Adding New Countries

To add support for a new country:

1. **Add profile** in `country-profiles.ts`:
```typescript
{
  code: "JP",
  name: "Japan",
  locales: ["ja", "en"],
  currency: "JPY",
  academicYearStartsMonth: 4,
  feeTerms: ["授業料", "学費", "tuition", "fees"],
  admissionTerms: ["入学", "出願", "admission", "apply"],
  scholarshipTerms: ["奨学金", "scholarship"]
}
```

2. **Test** with a harvest job
3. **Verify** terminology matches real university sites
4. **Adjust** terms if needed

## Performance

- **Discovery**: ~2-5 min for 50 universities
- **Processing**: ~30-60 sec per university
- **Firecrawl**: 20-25 pages per site
- **Timeout**: 12 sec per page
- **Total**: ~30-60 min for 50 universities

## Best Practices

1. **Always use profiles**: Don't hardcode terminology
2. **Verify with content**: Don't trust URLs alone
3. **Render when needed**: Dynamic sites need JS execution
4. **Track evidence**: Always store source URLs
5. **Check academic year**: Prefer current/next year data
6. **Normalize domains**: Use eTLD+1 for comparison

## Future Enhancements

- [ ] AI-powered term suggestion per country
- [ ] Automatic profile updates from successful extractions
- [ ] Multi-language UI for harvest monitoring
- [ ] Quality scoring based on evidence completeness
- [ ] Automated freshness checks
- [ ] Notification for stale data

## Troubleshooting

### No pages found
- Check Firecrawl API key
- Verify university website is accessible
- Check if site has sitemap.xml

### Wrong currency detected
- Review profile currency code
- Check if site uses multiple currencies
- Verify currency symbols in regex

### Pages not on domain
- Check eTLD+1 extraction
- Verify site doesn't use CDN for content
- Look for redirects to external domains

### Low confidence scores
- Review extraction quality
- Check if required fields are present
- Verify academic year is recent

---

**Built with:** TypeScript, Deno, Supabase, Firecrawl, OpenAI
**Status:** ✅ Production Ready
**Version:** 2.0 (Country-Agnostic)
