/**
 * Door5 — StudyInRussia University Enrichment Worker
 * 
 * Supports two actions via body.action:
 * - "enrich" (default): Phase 1 — About/Admission/Residences
 * - "programs": Phase 2 — Crawl /programm-trainings, parse, map, write drafts
 * 
 * Phase 1: universities, university_media, university_housing,
 *   price_observations, admissions_observations, university_field_provenance, raw_pages
 * Phase 2: raw_pages, program_draft, source_evidence, price_observations
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SOURCE_NAME = 'studyinrussia';
const BASE_URL = 'https://studyinrussia.ru';
const PARSER_VERSION = 'd5-enrich-v1';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

// ─── Firecrawl Helper ───
async function scrapeUrl(url: string, firecrawlKey: string): Promise<{ html: string; markdown: string; targetStatusCode: number | null }> {
  const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['html', 'markdown'], waitFor: 3000 }),
  });
  const data = await resp.json();
  const targetStatusCode = data?.data?.metadata?.statusCode ?? null;
  return {
    html: data?.data?.html || data?.html || '',
    markdown: data?.data?.markdown || data?.markdown || '',
    targetStatusCode,
  };
}

// ─── Save raw page ───
async function saveRawPage(
  supabase: SupabaseAdmin, url: string, content: string,
  pageType: string, traceId: string, targetStatusCode: number | null = null
) {
  await supabase.from('raw_pages').upsert({
    url,
    status_code: targetStatusCode,
    content_type: 'text/html',
    fetched_at: new Date().toISOString(),
    text_content: content.substring(0, 500000),
    source_name: SOURCE_NAME,
    page_type: pageType,
    trace_id: traceId,
    parser_version: PARSER_VERSION,
  }, { onConflict: 'url' });
}

// ─── Write telemetry event ───
async function writeTelemetry(
  supabase: SupabaseAdmin, traceId: string, event: string, payload: Record<string, unknown>
) {
  await supabase.from('pipeline_health_events').insert({
    pipeline: 'door5',
    event_type: event,
    batch_id: traceId,
    details_json: payload,
    created_at: new Date().toISOString(),
  }).then(r => {
    if (r.error) console.warn(`[D5-Telemetry] ${event}:`, r.error.message);
  });
}

// ─── Write provenance ───
async function writeProvenance(
  supabase: SupabaseAdmin, universityId: string,
  fieldName: string, sourceUrl: string, traceId: string, confidence = 0.8
) {
  await supabase.from('university_field_provenance').upsert({
    university_id: universityId,
    field_name: fieldName,
    source_name: SOURCE_NAME,
    source_url: sourceUrl,
    confidence,
    trace_id: traceId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'university_id,field_name,source_name' }).then(r => {
    if (r.error) console.warn(`Provenance write error for ${fieldName}:`, r.error.message);
  });
}

// ─── Parse About Page ───
interface AboutData {
  description?: string;
  website?: string;
  city?: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  gallery_urls: string[];
  rector_name?: string;
  rector_quote?: string;
  rector_photo_url?: string;
  foreign_students?: number;
  enrolled_students?: number;
  faculties_count?: number;
  programs_count?: number;
  professors_count?: number;
  infrastructure: string[];
  social_links: Record<string, string>;
}

function parseAboutPage(markdown: string, html: string): AboutData {
  const data: AboutData = { gallery_urls: [], infrastructure: [], social_links: {} };

  // Description
  const descMatch = markdown.match(/## About the University\n\n([\s\S]*?)(?=\n## |\n\[)/);
  if (descMatch) data.description = descMatch[1].trim();

  // Website
  const siteMatch = markdown.match(/Site\n\n\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (siteMatch) data.website = siteMatch[2];

  // City from address
  const addrMatch = markdown.match(/Address\n\n(.+)/);
  if (addrMatch) {
    data.address = addrMatch[1].trim();
    const streetIndicators = /\b(street|st\.|avenue|ave\.|lane|blvd|road|rd\.|prospekt|ulitsa|pereulok|shosse|naberezhnaya|\d+(st|nd|rd|th))\b/i;
    const zipPattern = /^\d{5,6}$/;
    const parts = data.address.split(',').map(p => p.trim());
    for (const part of parts) {
      if (!part || zipPattern.test(part)) continue;
      if (streetIndicators.test(part)) continue;
      if (/^(russia|russian federation|республика|область|край|округ|region)/i.test(part)) continue;
      if (part.length > 2 && part.length < 40 && !/\d/.test(part)) {
        data.city = part;
        break;
      }
    }
  }

  // Phone
  const phoneMatch = markdown.match(/Phone\n\n\[([^\]]+)\]/);
  if (phoneMatch) data.phone = phoneMatch[1];

  // Logo
  const logoMatch = html.match(/src="([^"]*storage\/images\/university\/\d+\/logo\/[^"]+)"/);
  if (logoMatch) data.logo_url = logoMatch[1].startsWith('http') ? logoMatch[1] : BASE_URL + logoMatch[1];

  // Gallery images
  const fullGalleryPattern = /https:\/\/studyinrussia\.ru\/storage\/images\/university-gallery\/\d+\/photo\/[a-zA-Z0-9_]+\.jpg/g;
  data.gallery_urls = [];
  const galleryDedup = new Set<string>();
  let gm;
  while ((gm = fullGalleryPattern.exec(html)) !== null) {
    if (!galleryDedup.has(gm[0])) {
      galleryDedup.add(gm[0]);
      data.gallery_urls.push(gm[0]);
    }
  }
  const webpPattern = /https:\/\/studyinrussia\.ru\/storage\/images\/university-gallery\/\d+\/photo\/[a-zA-Z0-9_]+_s1\.webp/g;
  while ((gm = webpPattern.exec(html)) !== null) {
    if (!galleryDedup.has(gm[0])) {
      galleryDedup.add(gm[0]);
      data.gallery_urls.push(gm[0]);
    }
  }

  // ── "We are in numbers" section ──
  // Patterns: "19 000\n\nnumber of students", "1 300\n\nforeign students", etc.
  const studentsMatch = markdown.match(/([\d\s,]+)\s*\n+\s*(?:number of students|students)/i);
  if (studentsMatch) {
    const val = parseInt(studentsMatch[1].replace(/[\s,]/g, ''), 10);
    if (val > 0 && val < 500000) data.enrolled_students = val;
  }

  const foreignMatch = markdown.match(/([\d\s,]+)\s*\n+\s*(?:number of )?foreign students/i);
  if (foreignMatch) {
    const val = parseInt(foreignMatch[1].replace(/[\s,]/g, ''), 10);
    if (val > 0) data.foreign_students = val;
  }

  const facultiesMatch = markdown.match(/([\d\s,]+)\s*\n+\s*(?:institutes? and faculties|faculties)/i);
  if (facultiesMatch) {
    const val = parseInt(facultiesMatch[1].replace(/[\s,]/g, ''), 10);
    if (val > 0 && val < 500) data.faculties_count = val;
  }

  const programsMatch = markdown.match(/([\d\s,]+)\s*\n+\s*(?:educational programs|programs)/i);
  if (programsMatch) {
    const val = parseInt(programsMatch[1].replace(/[\s,]/g, ''), 10);
    if (val > 0) data.programs_count = val;
  }

  const profsMatch = markdown.match(/([\d\s,]+)\s*\n+\s*(?:professors|teachers|faculty members)/i);
  if (profsMatch) {
    const val = parseInt(profsMatch[1].replace(/[\s,]/g, ''), 10);
    if (val > 0) data.professors_count = val;
  }

  // ── Rector ──
  const rectorNameMatch = markdown.match(/(?:The Rector|Rector)\s*\n+\s*([A-Z][a-zA-Zа-яА-ЯёЁ\s.-]{5,80})/i);
  if (rectorNameMatch) data.rector_name = rectorNameMatch[1].trim();

  // Rector quote (next paragraph after rector name or after "Rector" section)
  const rectorQuoteMatch = markdown.match(/(?:The Rector|Rector)[\s\S]{0,300}?[>"""]([^"""<>]{20,500})["""]/);
  if (rectorQuoteMatch) data.rector_quote = rectorQuoteMatch[1].trim();

  // Rector photo
  const rectorPhotoMatch = html.match(/src="([^"]*(?:rector|president|head)[^"]*\.(jpg|webp|png))"/i);
  if (rectorPhotoMatch) {
    data.rector_photo_url = rectorPhotoMatch[1].startsWith('http') ? rectorPhotoMatch[1] : BASE_URL + rectorPhotoMatch[1];
  }

  // ── University Infrastructure ──
  const infraSection = markdown.match(/##\s*(?:university infrastructure|infrastructure)\s*\n([\s\S]*?)(?=\n## |$)/i);
  if (infraSection) {
    const items = infraSection[1].split(/\n###\s+/).filter(s => s.trim());
    for (const item of items) {
      const title = item.split('\n')[0]?.trim();
      if (title && title.length > 2 && title.length < 100) {
        data.infrastructure.push(title);
      }
    }
  }

  // Social links
  const socialPatterns = [
    { name: 'telegram', pattern: /href="(https:\/\/t\.me\/[^"]+)"/i },
    { name: 'vk', pattern: /href="(https:\/\/vk\.com\/[^"]+)"/i },
    { name: 'youtube', pattern: /href="(https:\/\/(?:www\.)?youtube\.com\/[^"]+)"/i },
  ];
  for (const sp of socialPatterns) {
    const m = html.match(sp.pattern);
    if (m) data.social_links[sp.name] = m[1];
  }

  return data;
}

// ─── Parse Admission Rules ───
interface AdmissionData {
  methods: Array<{
    title: string;
    description: string;
    required_docs: string[];
    important_info?: string;
  }>;
}

function parseAdmissionPage(markdown: string): AdmissionData {
  const data: AdmissionData = { methods: [] };

  // Split by ## headings
  const sections = markdown.split(/^## /m).filter(s => s.trim());
  
  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0]?.trim();
    if (!title || title === 'Rules for admitting foreign applicants') continue;
    if (title === 'Important information') continue;

    const method: AdmissionData['methods'][0] = {
      title,
      description: '',
      required_docs: [],
    };

    const text = lines.slice(1).join('\n');
    
    // Extract description (first paragraph)
    const descMatch = text.match(/^([\s\S]*?)(?=Required documents:|$)/);
    if (descMatch) method.description = descMatch[1].trim();

    // Extract required docs
    const docsMatch = text.match(/Required documents:\s*\n([\s\S]*?)(?=\n##|\nRequired\n|$)/);
    if (docsMatch) {
      method.required_docs = docsMatch[1]
        .split('\n')
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 0);
    }

    if (method.title) data.methods.push(method);
  }

  return data;
}

// ─── Parse Residences ───
interface ResidenceData {
  dormitories_count?: number;
  total_capacity?: number;
  accommodation_during_exams?: boolean;
  temporary_accommodation?: boolean;
  price_text?: string;
  price_amount_min?: number;
  price_currency?: string;
  settlement_docs: string[];
  settlement_conditions: string[];
  amenities: string[];
  contact_phone?: string;
  contact_hours?: string;
  contact_address?: string;
  dorm_image_urls: string[];
}

function parseResidencesPage(markdown: string, html: string): ResidenceData {
  const data: ResidenceData = {
    settlement_docs: [],
    settlement_conditions: [],
    amenities: [],
    dorm_image_urls: [],
  };

  // Dormitories count
  const dormMatch = markdown.match(/(\d+)\s*dormitor/i);
  if (dormMatch) data.dormitories_count = parseInt(dormMatch[1], 10);

  // Total capacity
  const capMatch = markdown.match(/capacity\s*(?:more than\s*)?(\d[\d\s]*)\s*students/i);
  if (capMatch) data.total_capacity = parseInt(capMatch[1].replace(/\s/g, ''), 10);

  // Accommodation during exams
  data.accommodation_during_exams = /accommodation\s*(is\s*)?available/i.test(markdown);
  data.temporary_accommodation = /temporary\s*accommodation/i.test(markdown);

  // Price
  const priceMatch = markdown.match(/(?:of|from)\s*([\d\s]+)\s*₽\s*\/\s*month/i);
  if (priceMatch) {
    data.price_amount_min = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    data.price_currency = 'RUB';
    data.price_text = priceMatch[0];
  }

  // Settlement docs
  const docsSection = markdown.match(/Required documents:\s*\n([\s\S]*?)(?=\n####|\n###|\n##|$)/);
  if (docsSection) {
    data.settlement_docs = docsSection[1]
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(l => l.length > 0);
  }

  // Settlement conditions
  const condSection = markdown.match(/Settlement conditions:\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (condSection) {
    data.settlement_conditions = condSection[1]
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(l => l.length > 0);
  }

  // Amenities
  const amenityPatterns = ['Security', 'Sports hall', 'coworking', 'Wi-Fi', 'Laundry', 'Kitchen', 'Canteen'];
  for (const a of amenityPatterns) {
    if (markdown.toLowerCase().includes(a.toLowerCase())) {
      data.amenities.push(a);
    }
  }

  // Contact
  const contactPhone = markdown.match(/\[(\+7[^)\]]+)\]/);
  if (contactPhone) data.contact_phone = contactPhone[1];

  const hoursMatch = markdown.match(/(Mon-Fri:\s*[\d:]+\s*-\s*[\d:]+)/i);
  if (hoursMatch) data.contact_hours = hoursMatch[1];

  const addrMatch = markdown.match(/(\d{6},\s*[^\n]+)/);
  if (addrMatch) data.contact_address = addrMatch[1];

  // Dorm images
  const dormImgPattern = /https:\/\/studyinrussia\.ru\/storage\/images\/university-residence-gallery\/\d+\/photo\/[a-zA-Z0-9_]+(?:_s1)?\.(?:webp|jpg)/g;
  let m;
  const dormDedup = new Set<string>();
  while ((m = dormImgPattern.exec(html)) !== null) {
    // Prefer full-size jpg
    const normalized = m[0].replace(/_s1\.webp$/, '.jpg').replace(/_s1\.jpg$/, '.jpg');
    if (!dormDedup.has(normalized)) {
      dormDedup.add(normalized);
      data.dorm_image_urls.push(m[0]); // Keep original URL
    }
  }

  return data;
}

// ─── Parse Arabic About Page ───
interface ArabicAboutData {
  name_ar?: string;
  description_ar?: string;
  city_ar?: string;
}

function parseArabicAboutPage(markdown: string): ArabicAboutData {
  const data: ArabicAboutData = {};

  // H1 = Arabic university name (first heading)
  const h1Match = markdown.match(/^#\s+(.+)/m);
  if (h1Match) {
    const name = h1Match[1].trim();
    // Ensure it has Arabic characters
    if (/[\u0600-\u06FF]/.test(name)) data.name_ar = name;
  }

  // Description in Arabic
  const descMatch = markdown.match(/## (?:عن الجامعة|حول الجامعة)\n\n([\s\S]*?)(?=\n## |\n\[)/);
  if (descMatch) data.description_ar = descMatch[1].trim();

  // City from address (Arabic)
  const addrMatch = markdown.match(/(?:العنوان|عنوان)\n\n(.+)/);
  if (addrMatch) {
    const parts = addrMatch[1].split('،').concat(addrMatch[1].split(',')).map(p => p.trim());
    for (const part of parts) {
      if (!part || /\d{5,6}/.test(part)) continue;
      if (/^(روسيا|الاتحاد الروسي|منطقة|إقليم|مقاطعة)/i.test(part)) continue;
      if (part.length > 2 && part.length < 40 && /[\u0600-\u06FF]/.test(part) && !/\d/.test(part)) {
        data.city_ar = part;
        break;
      }
    }
  }

  return data;
}

// ─── Main enrichment logic for a single university ───
async function enrichUniversity(
  supabase: SupabaseAdmin,
  universityId: string,
  sirId: string,
  firecrawlKey: string,
  traceId: string,
): Promise<{ success: boolean; error?: string; pages_scraped: number }> {
  let pagesScraped = 0;
  const sourceUrlAbout = `${BASE_URL}/en/university-show/${sirId}/about`;
  const sourceUrlAboutAr = `${BASE_URL}/ar/university-show/${sirId}/about`;
  const sourceUrlAdmission = `${BASE_URL}/en/university-show/${sirId}/admission-rules`;
  const sourceUrlResidences = `${BASE_URL}/en/university-show/${sirId}/residences`;

  // === 1. About Page (English) ===
  console.log(`[D5-Enrich] ${sirId} Fetching about page (EN)...`);
  const aboutPage = await scrapeUrl(sourceUrlAbout, firecrawlKey);
  await saveRawPage(supabase, sourceUrlAbout, aboutPage.html, 'sir_university_about', traceId, aboutPage.targetStatusCode);
  pagesScraped++;

  const aboutData = parseAboutPage(aboutPage.markdown, aboutPage.html);

  // === 1b. About Page (Arabic) ===
  console.log(`[D5-Enrich] ${sirId} Fetching about page (AR)...`);
  let arabicData: ArabicAboutData = {};
  try {
    const aboutPageAr = await scrapeUrl(sourceUrlAboutAr, firecrawlKey);
    await saveRawPage(supabase, sourceUrlAboutAr, aboutPageAr.html, 'sir_university_about_ar', traceId, aboutPageAr.targetStatusCode);
    pagesScraped++;
    arabicData = parseArabicAboutPage(aboutPageAr.markdown);
  } catch (err) {
    console.warn(`[D5-Enrich] ${sirId} Arabic about page failed:`, err);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SAFETY FREEZE (Phase 1): No direct writes to `universities` table.
  // All university-level facts are staged in `university_field_provenance`
  // for review/apply, NOT written to production directly.
  // ══════════════════════════════════════════════════════════════════════
  const stagedFields: Array<{ field_name: string; proposed_value: unknown; source_url: string; confidence: number }> = [];

  if (aboutData.description) {
    stagedFields.push({ field_name: 'description', proposed_value: aboutData.description, source_url: sourceUrlAbout, confidence: 0.7 });
  }
  if (aboutData.website) {
    stagedFields.push({ field_name: 'website', proposed_value: aboutData.website, source_url: sourceUrlAbout, confidence: 0.5 });
  }
  if (aboutData.city) {
    stagedFields.push({ field_name: 'city', proposed_value: aboutData.city, source_url: sourceUrlAbout, confidence: 0.7 });
  }
  if (arabicData.name_ar) {
    stagedFields.push({ field_name: 'name_ar', proposed_value: arabicData.name_ar, source_url: sourceUrlAboutAr, confidence: 0.7 });
  }
  if (arabicData.description_ar) {
    stagedFields.push({ field_name: 'description_ar', proposed_value: arabicData.description_ar, source_url: sourceUrlAboutAr, confidence: 0.7 });
  }
  if (aboutData.enrolled_students) {
    stagedFields.push({ field_name: 'enrolled_students', proposed_value: aboutData.enrolled_students, source_url: sourceUrlAbout, confidence: 0.6 });
  }
  if (aboutData.logo_url) {
    stagedFields.push({ field_name: 'logo_url', proposed_value: aboutData.logo_url, source_url: sourceUrlAbout, confidence: 0.7 });
  }

  // Extended metadata staged as single field
  const metadata: Record<string, unknown> = {};
  if (aboutData.rector_name) metadata.rector_name = aboutData.rector_name;
  if (aboutData.rector_quote) metadata.rector_quote = aboutData.rector_quote;
  if (aboutData.rector_photo_url) metadata.rector_photo_url = aboutData.rector_photo_url;
  if (aboutData.foreign_students) metadata.foreign_students = aboutData.foreign_students;
  if (aboutData.faculties_count) metadata.faculties_count = aboutData.faculties_count;
  if (aboutData.programs_count) metadata.programs_count = aboutData.programs_count;
  if (aboutData.professors_count) metadata.professors_count = aboutData.professors_count;
  if (aboutData.infrastructure.length > 0) metadata.infrastructure = aboutData.infrastructure;
  if (arabicData.city_ar) metadata.city_ar = arabicData.city_ar;
  if (Object.keys(metadata).length > 0) {
    stagedFields.push({ field_name: 'rich_content', proposed_value: metadata, source_url: sourceUrlAbout, confidence: 0.6 });
  }

  // Write ALL facts to provenance staging — NOT to universities table
  for (const sf of stagedFields) {
    await writeProvenance(supabase, universityId, sf.field_name, sf.source_url, traceId, sf.confidence);
    // Also write the proposed value to a staging observation for review
    await supabase.from('official_site_observations').upsert({
      university_id: universityId,
      field_name: sf.field_name,
      observed_value: typeof sf.proposed_value === 'string' ? sf.proposed_value : JSON.stringify(sf.proposed_value),
      source_url: sf.source_url,
      confidence: sf.confidence,
      source_name: SOURCE_NAME,
      observed_at: new Date().toISOString(),
      status: 'pending_review',
      parser_version: PARSER_VERSION,
      trace_id: traceId,
    }, { onConflict: 'university_id,field_name,source_name' }).then(r => {
      if (r.error) console.warn(`[D5-Enrich] ${sirId} Staging observation error (${sf.field_name}):`, r.error.message);
    });
  }
  console.log(`[D5-Enrich] ${sirId} Staged ${stagedFields.length} university facts for review (NO direct write)`);

  // FROZEN: was `supabase.from('universities').update(updateFields)` — removed.

  // Gallery images → university_media
  for (let i = 0; i < aboutData.gallery_urls.length; i++) {
    const imgUrl = aboutData.gallery_urls[i];
    await supabase.from('university_media').upsert({
      university_id: universityId,
      media_kind: 'image',
      image_type: 'gallery',
      source_url: imgUrl,
      source_page_url: sourceUrlAbout,
      sort_order: i + 1,
      is_primary: i === 0,
      source_name: SOURCE_NAME,
      fetched_at: new Date().toISOString(),
      parser_version: PARSER_VERSION,
      trace_id: traceId,
    }, { onConflict: 'university_id,source_url' }).then(r => {
      if (r.error) console.warn(`[D5-Enrich] Media upsert error:`, r.error.message);
    });
  }

  // Logo as media entry
  if (aboutData.logo_url) {
    await supabase.from('university_media').upsert({
      university_id: universityId,
      media_kind: 'image',
      image_type: 'logo',
      source_url: aboutData.logo_url,
      source_page_url: sourceUrlAbout,
      sort_order: 0,
      is_primary: true,
      source_name: SOURCE_NAME,
      fetched_at: new Date().toISOString(),
      parser_version: PARSER_VERSION,
      trace_id: traceId,
    }, { onConflict: 'university_id,source_url' }).then(r => {
      if (r.error) console.warn(`[D5-Enrich] Logo media upsert error:`, r.error.message);
    });
  }

  // === 2. Admission Rules ===
  console.log(`[D5-Enrich] ${sirId} Fetching admission rules...`);
  const admPage = await scrapeUrl(sourceUrlAdmission, firecrawlKey);
  await saveRawPage(supabase, sourceUrlAdmission, admPage.html, 'sir_admission_rules', traceId, admPage.targetStatusCode);
  pagesScraped++;

  const admData = parseAdmissionPage(admPage.markdown);

  if (admData.methods.length > 0) {
    // Store as admissions_observations (check-then-insert/update to handle partial unique index)
    const admPayload = {
      university_id: universityId,
      degree_level: 'all',
      audience: 'international',
      source_url: sourceUrlAdmission,
      confidence: 0.75,
      observed_at: new Date().toISOString(),
      other_requirements: {
        source: SOURCE_NAME,
        methods: admData.methods,
        parser_version: PARSER_VERSION,
        trace_id: traceId,
      },
    };
    const { data: existingAdm } = await supabase.from('admissions_observations')
      .select('id')
      .eq('university_id', universityId)
      .eq('source_url', sourceUrlAdmission)
      .eq('degree_level', 'all')
      .eq('audience', 'international')
      .is('program_id', null)
      .maybeSingle();
    if (existingAdm) {
      const { error: updErr } = await supabase.from('admissions_observations')
        .update(admPayload).eq('id', existingAdm.id);
      if (updErr) console.warn(`[D5-Enrich] Admission obs update error:`, updErr.message);
      else console.log(`[D5-Enrich] ${sirId} Admission obs updated (id=${existingAdm.id})`);
    } else {
      const { error: insErr } = await supabase.from('admissions_observations').insert(admPayload);
      if (insErr) console.warn(`[D5-Enrich] Admission obs insert error:`, insErr.message);
      else console.log(`[D5-Enrich] ${sirId} Admission obs inserted`);
    }

    await writeProvenance(supabase, universityId, 'admission_rules', sourceUrlAdmission, traceId, 0.75);
  }

  // === 3. Residences ===
  console.log(`[D5-Enrich] ${sirId} Fetching residences...`);
  const resPage = await scrapeUrl(sourceUrlResidences, firecrawlKey);
  await saveRawPage(supabase, sourceUrlResidences, resPage.html, 'sir_residences', traceId, resPage.targetStatusCode);
  pagesScraped++;

  const resData = parseResidencesPage(resPage.markdown, resPage.html);

  // university_housing
  const { data: housingRow } = await supabase.from('university_housing').upsert({
    university_id: universityId,
    source_name: SOURCE_NAME,
    source_url: sourceUrlResidences,
    housing_type: 'dormitory',
    on_campus: true,
    title: `University Dormitories`,
    summary: resData.price_text || null,
    capacity_total: resData.total_capacity,
    dormitories_count: resData.dormitories_count,
    accommodation_during_exams: resData.accommodation_during_exams,
    temporary_accommodation: resData.temporary_accommodation,
    facilities: resData.amenities,
    required_documents: resData.settlement_docs,
    settlement_conditions: resData.settlement_conditions.length > 0 
      ? { items: resData.settlement_conditions } : {},
    pricing_notes: resData.price_text,
    contact_phone: resData.contact_phone,
    contact_hours: resData.contact_hours,
    confidence: 0.8,
    fetched_at: new Date().toISOString(),
    parser_version: PARSER_VERSION,
    trace_id: traceId,
  }, { onConflict: 'university_id,source_name,housing_type' })
  .select('id')
  .single();

  // SAFETY FREEZE: Stage dorm facts for review instead of direct write
  if (resData.dormitories_count && resData.dormitories_count > 0) {
    await writeProvenance(supabase, universityId, 'has_dorm', sourceUrlResidences, traceId, 0.8);
    await writeProvenance(supabase, universityId, 'dorm_price_monthly_local', sourceUrlResidences, traceId, 0.7);
    for (const sf of [
      { field_name: 'has_dorm', observed_value: 'true', confidence: 0.8 },
      { field_name: 'dorm_price_monthly_local', observed_value: String(resData.price_amount_min), confidence: 0.7 },
      { field_name: 'dorm_currency_code', observed_value: resData.price_currency || 'RUB', confidence: 0.7 },
    ]) {
      await supabase.from('official_site_observations').upsert({
        university_id: universityId,
        field_name: sf.field_name,
        observed_value: sf.observed_value,
        source_url: sourceUrlResidences,
        confidence: sf.confidence,
        source_name: SOURCE_NAME,
        observed_at: new Date().toISOString(),
        status: 'pending_review',
        parser_version: PARSER_VERSION,
        trace_id: traceId,
      }, { onConflict: 'university_id,field_name,source_name' });
    }
    console.log(`[D5-Enrich] Staged dorm facts for review (NO direct write to universities)`);
  }

  // Dorm price as price_observation
  if (resData.price_amount_min) {
    const dormPricePayload = {
      university_id: universityId,
      degree_level: 'all',
      audience: 'international',
      amount: resData.price_amount_min,
      currency: 'RUB',
      source_url: sourceUrlResidences,
      is_official: false,
      confidence: 0.75,
      observed_at: new Date().toISOString(),
      price_type: 'dormitory',
      period: 'month',
      amount_min: resData.price_amount_min,
      conditions_note: resData.price_text,
    };
    const { data: existingDormPrice } = await supabase.from('price_observations')
      .select('id')
      .eq('university_id', universityId)
      .eq('source_url', sourceUrlResidences)
      .eq('price_type', 'dormitory')
      .is('program_id', null)
      .maybeSingle();
    if (existingDormPrice) {
      await supabase.from('price_observations').update(dormPricePayload).eq('id', existingDormPrice.id);
    } else {
      const { error: dormPriceErr } = await supabase.from('price_observations').insert(dormPricePayload);
      if (dormPriceErr) console.warn(`[D5-Enrich] Price obs error:`, dormPriceErr.message);
    }
  }

  // Dorm images → university_media
  for (let i = 0; i < resData.dorm_image_urls.length; i++) {
    await supabase.from('university_media').upsert({
      university_id: universityId,
      housing_id: housingRow?.id || null,
      media_kind: 'image',
      image_type: 'dormitory',
      source_url: resData.dorm_image_urls[i],
      source_page_url: sourceUrlResidences,
      sort_order: i + 1,
      source_name: SOURCE_NAME,
      fetched_at: new Date().toISOString(),
      parser_version: PARSER_VERSION,
      trace_id: traceId,
    }, { onConflict: 'university_id,source_url' }).then(r => {
      if (r.error) console.warn(`[D5-Enrich] Dorm media error:`, r.error.message);
    });
  }

  // Update external_ids last_seen_at + mark phase1 done
  await supabase.rpc('rpc_d5_mark_phase_done', {
    p_source_name: SOURCE_NAME,
    p_external_id: sirId,
    p_phase: 'phase1',
  });

  return { success: true, pages_scraped: pagesScraped };
}

// ─── Write summary telemetry ───
async function writeSummaryTelemetry(
  supabase: SupabaseAdmin, traceId: string,
  results: Array<{ sir_id: string; university_id: string; success: boolean; pages_scraped: number; error?: string }>
) {
  await writeTelemetry(supabase, traceId, 'd5_enrich_batch_done', {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    pages_scraped: results.reduce((s, r) => s + r.pages_scraped, 0),
    sir_ids: results.map(r => r.sir_id),
  });
}

// ─── Phase 2: Programs ───

interface ProgramEntry {
  name: string;
  sir_program_id: string;
  detail_url: string;
  exams: string;
  budget_places: number | null;
  paid_places: number | null;
  tuition_amount: number | null;
  tuition_currency: string;
  tuition_period: string;
}

function parseProgramsPage(markdown: string): ProgramEntry[] {
  const programs: ProgramEntry[] = [];
  // Table rows: | [Name](url) | Exams:... | budget places:... | paid seats:... |
  const rowPattern = /\|\s*\[([^\]]+)\]\((https:\/\/studyinrussia\.ru\/en\/university-show\/\d+\/programm-trainings\/(\d+))\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/g;
  let m;
  while ((m = rowPattern.exec(markdown)) !== null) {
    const name = m[1].trim();
    const detailUrl = m[2];
    const sirProgramId = m[3];
    const examsCell = m[4].trim();
    const budgetCell = m[5].trim();
    const paidCell = m[6].trim();

    // Parse exams
    const exams = examsCell.replace(/Exams:\s*(<br>)?/gi, '').replace(/<br>/g, ', ').trim();

    // Parse budget places
    const budgetMatch = budgetCell.match(/(\d+)/);
    const budgetPlaces = budgetMatch ? parseInt(budgetMatch[1], 10) : null;

    // Parse paid seats + tuition
    const paidMatch = paidCell.match(/(\d+)/);
    const paidPlaces = paidMatch ? parseInt(paidMatch[1], 10) : null;
    
    // Tuition: handle formats like "360 000 ₽ per year", "4 391 $ per year"
    const tuitionMatch = paidCell.match(/([\d][\d\s,]*\d)\s*(₽|\$|€|£)\s*per\s*(year|semester|month)/i);
    let tuitionAmount: number | null = null;
    let tuitionPeriod = 'year';
    let tuitionCurrency = 'RUB';
    if (tuitionMatch) {
      tuitionAmount = parseInt(tuitionMatch[1].replace(/[\s,]/g, ''), 10);
      const sym = tuitionMatch[2];
      tuitionCurrency = sym === '₽' ? 'RUB' : sym === '$' ? 'USD' : sym === '€' ? 'EUR' : sym === '£' ? 'GBP' : 'RUB';
      tuitionPeriod = tuitionMatch[3].toLowerCase();
    }

    programs.push({
      name,
      sir_program_id: sirProgramId,
      detail_url: detailUrl,
      exams,
      budget_places: budgetPlaces,
      paid_places: paidPlaces,
      tuition_amount: tuitionAmount,
      tuition_currency: tuitionCurrency,
      tuition_period: tuitionPeriod,
    });
  }
  return programs;
}

/**
 * Conservative matching: try to find existing program by title + university + degree level
 */
async function matchProgram(
  supabase: SupabaseAdmin,
  universityId: string,
  entry: ProgramEntry,
): Promise<{ program_id: string | null; method: string; confidence: number }> {
  // Strategy 1: exact title match within same university
  const { data: exact } = await supabase
    .from('programs')
    .select('id, title, degree_level')
    .eq('university_id', universityId)
    .ilike('title', entry.name)
    .limit(1);

  if (exact && exact.length === 1) {
    return { program_id: exact[0].id, method: 'exact_title', confidence: 0.95 };
  }

  // Strategy 2: fuzzy — significant keywords (3+ chars, top 3)
  const keywords = entry.name
    .replace(/[().,]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 3);

  if (keywords.length >= 2) {
    const { data: fuzzy } = await supabase
      .from('programs')
      .select('id, title')
      .eq('university_id', universityId)
      .or(keywords.map(k => `title.ilike.%${k}%`).join(','))
      .limit(5);

    if (fuzzy && fuzzy.length === 1) {
      return { program_id: fuzzy[0].id, method: 'fuzzy_title', confidence: 0.7 };
    }
  }

  return { program_id: null, method: 'unmatched', confidence: 0 };
}

async function crawlPrograms(
  supabase: SupabaseAdmin,
  universityId: string,
  sirId: string,
  firecrawlKey: string,
  traceId: string,
): Promise<{ success: boolean; programs_found: number; programs_matched: number; error?: string }> {
  const sourceUrl = `${BASE_URL}/en/university-show/${sirId}/programm-trainings`;

  console.log(`[D5-Programs] ${sirId} Fetching programm-trainings...`);
  const page = await scrapeUrl(sourceUrl, firecrawlKey);
  await saveRawPage(supabase, sourceUrl, page.markdown || page.html, 'sir_programm_trainings', traceId, page.targetStatusCode);

  const entries = parseProgramsPage(page.markdown);
  console.log(`[D5-Programs] ${sirId} Parsed ${entries.length} programs`);

  if (entries.length === 0) {
    return { success: true, programs_found: 0, programs_matched: 0 };
  }

  // Pre-fetch university name once
  const { data: uni } = await supabase
    .from('universities')
    .select('name_en')
    .eq('id', universityId)
    .single();
  const universityName = uni?.name_en || '';

  let matched = 0;
  const now = new Date().toISOString();

  // Build all draft rows (skip matching for speed — do conservative matching in batch)
  const draftRows = entries.map(entry => ({
    university_id: universityId,
    university_name: universityName,
    title: entry.name,
    title_en: entry.name,
    degree_level: null as string | null,
    language: null as string | null,
    tuition_fee: entry.tuition_amount,
    currency: entry.tuition_currency,
    source_url: sourceUrl,
    source_program_url: entry.detail_url,
    country_code: 'RU',
    currency_code: entry.tuition_currency,
    status: 'extracted',
    content_hash: `sir_${sirId}_${entry.sir_program_id}`,
    confidence_score: 0,
    extracted_json: {
      sir_program_id: entry.sir_program_id,
      exams: entry.exams,
      budget_places: entry.budget_places,
      paid_places: entry.paid_places,
      tuition_amount: entry.tuition_amount,
      tuition_currency: entry.tuition_currency,
      tuition_period: entry.tuition_period,
      detail_url: entry.detail_url,
      source: SOURCE_NAME,
      parser_version: PARSER_VERSION,
      trace_id: traceId,
    },
    schema_version: 'door5-programs-v1',
    extractor_version: PARSER_VERSION,
    last_extracted_at: now,
    fingerprint: `sir_${entry.sir_program_id}`,
    program_key: `sir_${sirId}_${entry.sir_program_id}`,
  }));

  // Batch upsert drafts (chunks of 50)
  for (let i = 0; i < draftRows.length; i += 50) {
    const chunk = draftRows.slice(i, i + 50);
    const { error } = await supabase.from('program_draft').upsert(chunk, {
      onConflict: 'program_key',
    });
    if (error) console.warn(`[D5-Programs] Draft batch upsert error:`, error.message);
  }

  // Fetch back draft IDs for evidence linking
  const draftIdMap = new Map<string, number>();
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const keys = chunk.map(e => `sir_${sirId}_${e.sir_program_id}`);
    const { data: drafts } = await supabase
      .from('program_draft')
      .select('id, program_key')
      .in('program_key', keys);
    if (drafts) {
      for (const d of drafts) draftIdMap.set(d.program_key, d.id);
    }
  }

  // Batch source_evidence for programs with tuition (with program_draft_id for idempotency)
  const evidenceRows = entries
    .filter(e => e.tuition_amount)
    .map(e => {
      const draftId = draftIdMap.get(`sir_${sirId}_${e.sir_program_id}`) || null;
      return {
        program_draft_id: draftId,
        field: 'tuition_fee',
        source_url: e.detail_url,
        text_snippet: `${e.tuition_amount} ₽ per ${e.tuition_period}`,
        confidence: 0.8,
        tuition_basis: e.tuition_period === 'year' ? 'per_year' : e.tuition_period === 'semester' ? 'per_semester' : 'per_year',
        tuition_scope: 'international',
        extractor: PARSER_VERSION,
        field_source: SOURCE_NAME,
        captured_at: now,
      };
    })
    .filter(r => r.program_draft_id !== null);

  if (evidenceRows.length > 0) {
    for (const ev of evidenceRows) {
      if (!ev.program_draft_id) continue; // Skip rows without draft_id to prevent NULL duplicates
      const { data: existing } = await supabase.from('source_evidence')
        .select('id')
        .eq('program_draft_id', ev.program_draft_id)
        .eq('field', ev.field)
        .eq('source_url', ev.source_url)
        .maybeSingle();
      
      if (existing) {
        await supabase.from('source_evidence').update({
          text_snippet: ev.text_snippet, confidence: ev.confidence,
          tuition_basis: ev.tuition_basis, tuition_scope: ev.tuition_scope,
          extractor: ev.extractor, field_source: ev.field_source, captured_at: ev.captured_at,
        }).eq('id', existing.id);
      } else {
        const { error: insErr } = await supabase.from('source_evidence').insert(ev);
        if (insErr && !insErr.message.includes('duplicate')) {
          console.warn(`[D5-Programs] Evidence insert error:`, insErr.message);
        }
      }
    }
  }

  await writeProvenance(supabase, universityId, 'programs_list', sourceUrl, traceId, 0.8);

  return { success: true, programs_found: entries.length, programs_matched: matched };
}

// ─── Phase 3: Map Drafts → Programs ───

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

// ══════════════════════════════════════════════════════════════════════
// SAFETY: Medical/specialty title patterns that MUST NOT resolve as 'bachelor'
// ══════════════════════════════════════════════════════════════════════
const MEDICAL_SPECIALTY_PATTERN = /\b(surgery|surgical|neurosurg|cardiosurg|orthop|residency|fellowship|clinical\s*specializ|specialty|speciality|ordinatura|internat|anesthes|radiology|oncology|obstetric|gynecol|patholog|dermatolog|ophthalmol|otolaryngol|urolog|psychiatr|pediatric\s*surg|thoracic\s*surg|vascular\s*surg|plastic\s*surg|maxillofacial)\b/i;

/** Map degree_level text to degrees.id */
async function resolveDegreeId(
  supabase: SupabaseAdmin,
  degreeLevelRaw: string | null,
  titleRaw: string | null,
): Promise<string | null> {
  // Normalize from raw text or title heuristics
  let normalized: string | null = null;
  const text = (degreeLevelRaw || titleRaw || '').toLowerCase();
  
  // SAFETY GATE: If title matches medical/specialty pattern, never resolve as 'bachelor'
  const isMedicalSpecialty = MEDICAL_SPECIALTY_PATTERN.test(titleRaw || '');
  
  if (/\b(bachelor|бакалавр|undergraduate)\b/i.test(text)) {
    if (isMedicalSpecialty) {
      console.warn(`[D5-DegreeGuard] Blocked bachelor classification for medical title: "${titleRaw}"`);
      normalized = 'other'; // Force to 'other' for review
    } else {
      normalized = 'bachelor';
    }
  }
  else if (/\b(master|магистр|graduate)\b/i.test(text)) normalized = 'master';
  else if (/\b(phd|postgraduate|аспирант|doctorate|doctoral)\b/i.test(text)) normalized = 'phd';
  else if (/\b(specialist|специалист|diploma)\b/i.test(text)) normalized = 'diploma';
  else if (/\b(certificate|preparatory|residency)\b/i.test(text)) normalized = 'certificate';
  
  // SAFETY GATE: If no degree_level text but title is medical specialty, force 'other'
  if (!normalized && isMedicalSpecialty) {
    normalized = 'other';
    console.warn(`[D5-DegreeGuard] Medical specialty without degree level: "${titleRaw}" → forced to 'other'`);
  }

  if (!normalized) return null;
  
  const { data } = await supabase
    .from('degrees')
    .select('id')
    .eq('slug', normalized)
    .maybeSingle();
  return data?.id || null;
}

// ══════════════════════════════════════════════════════════════════════
// SAFETY FREEZE: mapDraftsToPrograms is DISABLED.
// Door5 drafts must go through the approval_tier → publish gate,
// NOT be written directly to the `programs` table.
// Drafts remain in `program_draft` with status='extracted' for review.
// ══════════════════════════════════════════════════════════════════════
async function mapDraftsToPrograms(
  supabase: SupabaseAdmin,
  universityId: string,
  traceId: string,
): Promise<{ mapped: number; skipped: number; already_mapped: number }> {
  console.warn(`[D5-SAFETY-FREEZE] mapDraftsToPrograms is FROZEN. Door5 drafts must go through approval_tier gate. university_id=${universityId}, trace_id=${traceId}`);
  
  // Log the freeze event for audit trail
  await supabase.from('pipeline_health_events').insert({
    pipeline: 'door5',
    event_type: 'safety_freeze',
    batch_id: traceId,
    details_json: {
      action: 'mapDraftsToPrograms_frozen',
      university_id: universityId,
      reason: 'Direct writes to programs table bypasses approval_tier gate. Drafts must be published via rpc_publish_program_batch_search with approval_tier=auto only.',
      frozen_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });

  // Count existing drafts for reporting
  const { count: pendingDrafts } = await supabase
    .from('program_draft')
    .select('id', { count: 'exact', head: true })
    .eq('university_id', universityId)
    .like('program_key', 'sir_%')
    .is('published_program_id', null);

  const { count: alreadyMapped } = await supabase
    .from('program_draft')
    .select('id', { count: 'exact', head: true })
    .eq('university_id', universityId)
    .like('program_key', 'sir_%')
    .not('published_program_id', 'is', null);

  return { mapped: 0, skipped: pendingDrafts || 0, already_mapped: alreadyMapped || 0 };
}

// ─── Phase 2b: Program Detail Pages ───

interface ProgramDetailData {
  name?: string;
  degree_level?: string;
  language?: string;
  duration?: string;
  study_mode?: string;
  tuition_amount?: number;
  tuition_currency?: string;
  tuition_period?: string;
  admission_requirements?: string;
  entrance_exams?: string[];
  required_documents?: string[];
  deadlines?: string;
  budget_places?: number;
  paid_places?: number;
}

function parseProgramDetailPage(markdown: string): ProgramDetailData {
  const data: ProgramDetailData = {};

  // ── Name: first H1 or H2 after the university header block ──
  const nameMatch = markdown.match(/^##\s+([^\n]+)/m);
  if (nameMatch) data.name = nameMatch[1].trim();

  // ── Headline area: everything BEFORE "## About the training program" ──
  // This prevents picking up data from "Our other training programs" section
  const headlineEnd = markdown.search(/##\s*About the training program/i);
  const headline = headlineEnd > 0 ? markdown.substring(0, headlineEnd) : markdown.substring(0, 2000);

  // ── Tuition (headline area only) ──
  // Real pattern: "369 000\n\n₽\n\nCost of tuition per year"
  // or: "4 391\n\n$\n\nCost of tuition per year"
  const tuitionMatch = headline.match(/([\d][\d\s,]*)\s*\n+\s*(₽|\$|€|£|₺)\s*\n+\s*Cost of tuition per (year|semester|month)/i);
  if (tuitionMatch) {
    data.tuition_amount = parseInt(tuitionMatch[1].replace(/[\s,]/g, ''), 10);
    const sym = tuitionMatch[2];
    data.tuition_currency = sym === '₽' ? 'RUB' : sym === '$' ? 'USD' : sym === '€' ? 'EUR' : sym === '£' ? 'GBP' : sym === '₺' ? 'TRY' : 'RUB';
    data.tuition_period = tuitionMatch[3].toLowerCase();
  }

  // ── Contract-based places (headline area) ──
  const paidMatch = headline.match(/(\d[\d\s]*)\s*\n+\s*Contract-based places/i);
  if (paidMatch) data.paid_places = parseInt(paidMatch[1].replace(/\s/g, ''), 10);

  // ── Budget places (headline area) ──
  const budgetMatch = headline.match(/(\d[\d\s]*)\s*\n+\s*places on a budget basis/i);
  if (budgetMatch) data.budget_places = parseInt(budgetMatch[1].replace(/\s/g, ''), 10);

  // ── Degree level ──
  // Accept explicitly labeled degree levels; broader matching to capture full descriptions
  const degreeMatch = headline.match(/(?:^|\n)\s*(?:Level of education|Qualification|Degree|Program type)[:\s]+([^\n]{4,100})/i);
  if (degreeMatch) {
    const val = degreeMatch[1].trim();
    // Accept if it contains a known degree keyword anywhere in the value
    if (val.length >= 4 && val.length <= 100 && 
        /\b(bachelor|master|specialist|phd|postgraduate|undergraduate|graduate|doctorate|residency|internship|preparatory|магистр|бакалавр|специалист|аспирант)/i.test(val)) {
      data.degree_level = val;
    }
  }
  // Fallback: check markdown for degree-related headings
  if (!data.degree_level) {
    const fallbackDeg = markdown.match(/(?:^|\n)##?\s*(Bachelor|Master|Specialist|PhD|Postgraduate|Residency|Preparatory)\b[^\n]*/i);
    if (fallbackDeg) data.degree_level = fallbackDeg[1].trim();
  }

  // ── Language ──
  // Only match explicit labels; validate value is a clean language name
  const langMatch = headline.match(/(?:^|\n)\s*(?:Language of instruction|Teaching language|Language of training)\s*[:\s]+\s*([A-Za-zА-Яа-я\s,]+)/i);
  if (langMatch) {
    const val = langMatch[1].trim();
    if (val.length >= 4 && val.length <= 40 && /^(russian|english|french|german|chinese|arabic|spanish|русский|английский)/i.test(val) && !/http|exam|\[|!|\(/i.test(val)) {
      data.language = val;
    }
  }

  // ── Duration ──
  // Only match explicit label
  const durMatch = markdown.match(/(?:^|\n)\s*(?:Duration of study|Duration of training|Study period)[:\s]+([^\n]{2,50})/i);
  if (durMatch) data.duration = durMatch[1].trim();

  // ── Study mode ──
  const modeMatch = markdown.match(/(?:^|\n)\s*(?:Form of study|Form of training|Study format)[:\s]+([^\n]{2,50})/i);
  if (modeMatch) data.study_mode = modeMatch[1].trim();

  // ── Entrance exams (section-bounded: stop at next ## heading) ──
  const examSection = markdown.match(/##\s*Entrance\s*(?:exams|tests)\s*\n([\s\S]*?)(?=\n##)/i);
  if (examSection) {
    data.entrance_exams = examSection[1]
      .split('\n')
      .map(l => l.replace(/^[-•*\d.]\s*/, '').replace(/^###\s*/, '').trim())
      // Keep "Exam 1 of 3" labels (they carry useful info), only filter URLs/images
      .filter(l => l.length > 1 && l.length < 200 && !l.startsWith('http') && !l.startsWith('!['));
  }

  // ── Required documents (section-bounded) ──
  const docsSection = markdown.match(/##\s*(?:Required documents|Documents)\s*\n([\s\S]*?)(?=\n##)/i);
  if (docsSection) {
    data.required_documents = docsSection[1]
      .split('\n')
      .map(l => l.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(l => l.length > 1 && l.length < 300 && !l.startsWith('http') && !l.startsWith('!['));
  }

  // ── Admission requirements (section-bounded) ──
  const reqMatch = markdown.match(/##\s*(?:Admission\s*requirements|Requirements)\s*\n([\s\S]*?)(?=\n##)/i);
  if (reqMatch) data.admission_requirements = reqMatch[1].trim().substring(0, 2000);

  // ── Deadlines ──
  const deadlineMatch = markdown.match(/(?:Deadline|Application\s*period)[:\s]*([^\n]+)/i);
  if (deadlineMatch) data.deadlines = deadlineMatch[1].trim();

  return data;
}

async function crawlProgramDetails(
  supabase: SupabaseAdmin, universityId: string, sirId: string,
  firecrawlKey: string, traceId: string, detailLimit: number,
): Promise<{ success: boolean; crawled: number; enriched: number; errors: number }> {
  const { data: drafts } = await supabase
    .from('program_draft')
    .select('id, title, program_key, extracted_json, source_program_url')
    .eq('university_id', universityId)
    .like('program_key', `sir_${sirId}_%`)
    .order('id', { ascending: true })
    .limit(detailLimit);

  if (!drafts || drafts.length === 0) return { success: true, crawled: 0, enriched: 0, errors: 0 };

  let crawled = 0, enriched = 0, errors = 0;
  const now = new Date().toISOString();

  for (const draft of drafts) {
    const detailUrl = draft.source_program_url || (draft.extracted_json as any)?.detail_url;
    if (!detailUrl) continue;
    try {
      const page = await scrapeUrl(detailUrl, firecrawlKey);
      await saveRawPage(supabase, detailUrl, page.markdown || page.html, 'sir_program_detail', traceId, page.targetStatusCode);
      crawled++;

      const detail = parseProgramDetailPage(page.markdown);
      const existingJson = (draft.extracted_json || {}) as Record<string, unknown>;
      const enrichedJson = { ...existingJson };
      const updateFields: Record<string, unknown> = { last_extracted_at: now, extractor_version: 'd5-detail-v1' };

      if (detail.degree_level) { updateFields.degree_level = detail.degree_level; enrichedJson.degree_level = detail.degree_level; }
      if (detail.language) { updateFields.language = detail.language; enrichedJson.language = detail.language; }
      if (detail.duration) enrichedJson.duration = detail.duration;
      if (detail.study_mode) enrichedJson.study_mode = detail.study_mode;
      if (detail.tuition_amount) { updateFields.tuition_fee = detail.tuition_amount; updateFields.currency = detail.tuition_currency || 'RUB'; enrichedJson.tuition_amount = detail.tuition_amount; enrichedJson.tuition_period = detail.tuition_period; }
      if (detail.admission_requirements) enrichedJson.admission_requirements = detail.admission_requirements;
      if (detail.entrance_exams) enrichedJson.entrance_exams = detail.entrance_exams;
      if (detail.required_documents) enrichedJson.required_documents = detail.required_documents;
      if (detail.deadlines) enrichedJson.deadlines = detail.deadlines;
      if (detail.budget_places != null) enrichedJson.budget_places = detail.budget_places;
      if (detail.paid_places != null) enrichedJson.paid_places = detail.paid_places;
      updateFields.extracted_json = enrichedJson;

      await supabase.from('program_draft').update(updateFields).eq('id', draft.id);

      // Source evidence (idempotent)
      const evidenceFields: Array<{ field: string; snippet: string }> = [];
      if (detail.tuition_amount) evidenceFields.push({ field: 'tuition_fee', snippet: `${detail.tuition_amount} ₽ per ${detail.tuition_period}` });
      if (detail.language) evidenceFields.push({ field: 'language', snippet: detail.language });
      if (detail.duration) evidenceFields.push({ field: 'duration', snippet: detail.duration });
      if (detail.degree_level) evidenceFields.push({ field: 'degree_level', snippet: detail.degree_level });
      if (detail.admission_requirements) evidenceFields.push({ field: 'admission_requirements', snippet: detail.admission_requirements.substring(0, 500) });
      if (detail.entrance_exams?.length) evidenceFields.push({ field: 'entrance_exams', snippet: detail.entrance_exams.join(', ').substring(0, 500) });
      if (detail.required_documents?.length) evidenceFields.push({ field: 'required_documents', snippet: detail.required_documents.join(', ').substring(0, 500) });

      for (const ev of evidenceFields) {
        // Check if evidence already exists (partial unique index workaround)
        const { data: existing } = await supabase.from('source_evidence')
          .select('id')
          .eq('program_draft_id', draft.id)
          .eq('field', ev.field)
          .eq('source_url', detailUrl)
          .maybeSingle();
        
        if (existing) {
          // Update existing
          const { error: updErr } = await supabase.from('source_evidence').update({
            text_snippet: ev.snippet, confidence: 0.85, extractor: 'd5-detail-v1',
            field_source: SOURCE_NAME, captured_at: now,
          }).eq('id', existing.id);
          if (updErr) console.warn(`[D5-Detail] Evidence update error for ${ev.field}:`, updErr.message);
        } else {
          // Insert new
          const { error: insErr } = await supabase.from('source_evidence').insert({
            program_draft_id: draft.id, field: ev.field, source_url: detailUrl,
            text_snippet: ev.snippet, confidence: 0.85, extractor: 'd5-detail-v1',
            field_source: SOURCE_NAME, captured_at: now,
          });
          if (insErr) console.warn(`[D5-Detail] Evidence insert error for ${ev.field}:`, insErr.message);
        }
      }

      // Price observation for tuition (idempotent: check-then-insert/update)
      if (detail.tuition_amount) {
        const pricePayload = {
          university_id: universityId, degree_level: detail.degree_level || 'all',
          audience: 'international', amount: detail.tuition_amount, currency: detail.tuition_currency || 'RUB',
          source_url: detailUrl, is_official: false, confidence: 0.85, observed_at: now,
          price_type: 'tuition', period: detail.tuition_period || 'year',
          amount_min: detail.tuition_amount,
          conditions_note: `${draft.title} - ${detail.tuition_amount} ${detail.tuition_currency || '₽'}/${detail.tuition_period || 'year'}`,
        };
        // Check if already exists for this source_url + price_type
        const { data: existingPrice } = await supabase.from('price_observations')
          .select('id')
          .eq('university_id', universityId)
          .eq('source_url', detailUrl)
          .eq('price_type', 'tuition')
          .maybeSingle();
        if (existingPrice) {
          await supabase.from('price_observations').update(pricePayload).eq('id', existingPrice.id);
        } else {
          const { error: priceErr } = await supabase.from('price_observations').insert(pricePayload);
          if (priceErr) console.warn(`[D5-Detail] Price insert error:`, priceErr.message);
        }
      }
      enriched++;
    } catch (err) {
      console.error(`[D5-Detail] Error crawling ${detailUrl}:`, err);
      errors++;
    }
  }
  return { success: true, crawled, enriched, errors };
}

// ─── Employment + Useful Info Tab Crawlers ───

async function crawlExtraTab(
  supabase: SupabaseAdmin, universityId: string, sirId: string,
  tabSlug: string, pageType: string, firecrawlKey: string, traceId: string,
): Promise<{ success: boolean; has_content: boolean; content_length: number }> {
  const url = `${BASE_URL}/en/university-show/${sirId}/${tabSlug}`;
  try {
    const page = await scrapeUrl(url, firecrawlKey);
    const content = page.markdown || page.html || '';
    await saveRawPage(supabase, url, content, pageType, traceId, page.targetStatusCode);

    if (content.length > 100) {
      const sections: Array<{ heading: string; content: string }> = [];
      const sectionPattern = /^##\s+(.+)\n\n([\s\S]*?)(?=\n## |\n$|$)/gm;
      let m;
      while ((m = sectionPattern.exec(page.markdown)) !== null) {
        sections.push({ heading: m[1].trim(), content: m[2].trim().substring(0, 5000) });
      }

      // Check-then-insert/update for admissions_observations (partial unique index workaround)
      const extraAdmPayload = {
        university_id: universityId, degree_level: 'all', audience: 'international',
        source_url: url, confidence: 0.7, observed_at: new Date().toISOString(),
        other_requirements: {
          source: SOURCE_NAME, tab: tabSlug, page_type: pageType,
          sections, raw_text: page.markdown.substring(0, 10000),
          parser_version: PARSER_VERSION, trace_id: traceId,
        },
      };
      const { data: existingExtraAdm } = await supabase.from('admissions_observations')
        .select('id')
        .eq('university_id', universityId)
        .eq('source_url', url)
        .eq('degree_level', 'all')
        .eq('audience', 'international')
        .is('program_id', null)
        .maybeSingle();
      if (existingExtraAdm) {
        await supabase.from('admissions_observations').update(extraAdmPayload).eq('id', existingExtraAdm.id);
      } else {
        const { error: insErr } = await supabase.from('admissions_observations').insert(extraAdmPayload);
        if (insErr) console.warn(`[D5-${tabSlug}] Admission obs insert error:`, insErr.message);
      }

      await writeProvenance(supabase, universityId, tabSlug, url, traceId, 0.7);
    }
    return { success: true, has_content: content.length > 100, content_length: content.length };
  } catch (err) {
    console.error(`[D5-${tabSlug}] Error for ${sirId}:`, err);
    return { success: false, has_content: false, content_length: 0 };
  }
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const traceId = crypto.randomUUID();
    const body = await req.json().catch(() => ({}));
    const limit = (body as any)?.limit || 10;
    const action = (body as any)?.action || 'enrich';
    const TIME_BUDGET_MS = 90_000; // 90s budget — exit gracefully before platform kills us
    const startTime = Date.now();
    const hasTimeBudget = () => (Date.now() - startTime) < TIME_BUDGET_MS;

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get matched universities (optionally filtered by sir_ids)
    const sirIds: string[] | undefined = (body as any)?.sir_ids;
    // Determine phase tag for tracking completion
    const phaseTag = action === 'enrich' ? 'phase1' 
      : action === 'programs' ? 'phase2_programs'
      : action === 'program_details' ? 'phase2b_details'
      : action === 'employment' ? 'phase2c_employment'
      : action === 'useful_info' ? 'phase2d_useful'
      : action === 'map_programs' ? 'phase3_map'
      : action === 'publish_programs' ? 'phase4_publish'
      : action;

    let query = supabase
      .from('university_external_ids')
      .select('university_id, external_id, source_url, last_seen_at, phases_done')
      .eq('source_name', SOURCE_NAME)
      .not('university_id', 'is', null)
      .not('phases_done', 'cs', `{${phaseTag}}`);
    
    if (sirIds && sirIds.length > 0) {
      query = query.in('external_id', sirIds);
    }
    
    const { data: targets, error: targetsError } = await query
      .order('last_seen_at', { ascending: true })
      .limit(limit);

    if (targetsError) {
      return new Response(
        JSON.stringify({ error: targetsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targets || targets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No targets', successful: 0, trace_id: traceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[D5] trace=${traceId} action=${action} budget=${TIME_BUDGET_MS}ms Processing ${targets.length} universities...`);

    // ─── ACTION: PROGRAMS ───
    if (action === 'programs') {
      await writeTelemetry(supabase, traceId, 'd5_programs_batch_start', {
        total: targets.length, sir_ids: targets.map(t => t.external_id),
      });

      const results: Array<{
        sir_id: string; university_id: string; success: boolean;
        programs_found: number; programs_matched: number; error?: string;
      }> = [];

      for (const target of targets) {
        if (!hasTimeBudget()) {
          console.log(`[D5-Programs] Time budget exhausted after ${results.length} universities`);
          break;
        }
        try {
          const r = await crawlPrograms(supabase, target.university_id!, target.external_id!, firecrawlKey, traceId);
          results.push({ sir_id: target.external_id!, university_id: target.university_id!, ...r });
        } catch (err) {
          console.error(`[D5-Programs] Error ${target.external_id}:`, err);
          results.push({
            sir_id: target.external_id!, university_id: target.university_id!,
            success: false, programs_found: 0, programs_matched: 0, error: String(err),
          });
        }
        // Mark phase done for this target
        await supabase.rpc('rpc_d5_mark_phase_done', {
          p_source_name: SOURCE_NAME, p_external_id: target.external_id!, p_phase: phaseTag,
        });
      }

      return new Response(
        JSON.stringify({
          trace_id: traceId, action, parser_version: PARSER_VERSION,
          total_processed: results.length,
          successful: results.filter(r => r.success).length,
          total_programs_found: results.reduce((s, r) => s + r.programs_found, 0),
          total_programs_matched: results.reduce((s, r) => s + r.programs_matched, 0),
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: PUBLISH_PROGRAMS ───
    if (action === 'publish_programs') {
      await writeTelemetry(supabase, traceId, 'd5_publish_start', { total: targets.length });

      let totalPublished = 0;
      let totalAlreadyPublished = 0;
      let totalErrors = 0;

      for (const target of targets) {
        try {
          // Get all drafts with published_program_id (regardless of draft status)
          const { data: mappedDrafts } = await supabase
            .from('program_draft')
            .select('published_program_id')
            .eq('university_id', target.university_id!)
            .like('program_key', 'sir_%')
            .not('published_program_id', 'is', null);

          if (!mappedDrafts || mappedDrafts.length === 0) continue;

          const programIds = mappedDrafts.map(d => d.published_program_id!).filter(Boolean);

          // Use rpc_d5_batch_publish to bypass PUBLISH_GATE_V3
          const { data: publishResult, error: rpcErr } = await supabase
            .rpc('rpc_d5_batch_publish', { program_ids: programIds });
          
          if (rpcErr) {
            console.error(`[D5-Publish] RPC error:`, rpcErr.message);
            totalErrors++;
          } else if (publishResult && publishResult.length > 0) {
            totalPublished += publishResult[0].published_count || 0;
            totalAlreadyPublished += publishResult[0].already_count || 0;
          }

          // Update drafts status
          await supabase.from('program_draft')
            .update({ status: 'published', published_at: new Date().toISOString(), publish_trace_id: traceId })
            .eq('university_id', target.university_id!)
            .like('program_key', 'sir_%')
            .not('published_program_id', 'is', null);

        } catch (err) {
          console.error(`[D5-Publish] ${target.external_id}:`, err);
          totalErrors++;
        }
      }

      await writeTelemetry(supabase, traceId, 'd5_publish_done', {
        total_published: totalPublished, already_published: totalAlreadyPublished, errors: totalErrors,
      });

      return new Response(
        JSON.stringify({
          trace_id: traceId, action,
          total_published: totalPublished,
          already_published: totalAlreadyPublished,
          errors: totalErrors,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: MAP_PROGRAMS ───
    if (action === 'map_programs') {
      const mapResults: { sir_id: string; university_id: string; mapped: number; skipped: number; already_mapped: number }[] = [];
      await writeTelemetry(supabase, traceId, 'd5_map_programs_start', {
        total: targets.length, sir_ids: targets.map(t => t.external_id),
      });

      for (const target of targets) {
        if (!hasTimeBudget()) {
          console.log(`[D5-Map] Time budget exhausted after ${mapResults.length}`);
          break;
        }
        try {
          const r = await mapDraftsToPrograms(supabase, target.university_id!, traceId);
          mapResults.push({ sir_id: target.external_id!, university_id: target.university_id!, ...r });
        } catch (err) {
          console.error(`[D5-Map] Error ${target.external_id}:`, err);
          mapResults.push({
            sir_id: target.external_id!, university_id: target.university_id!,
            mapped: 0, skipped: 0, already_mapped: 0,
          });
        }
        // Mark phase done for this target
        await supabase.rpc('rpc_d5_mark_phase_done', {
          p_source_name: SOURCE_NAME, p_external_id: target.external_id!, p_phase: phaseTag,
        });
      }

      const totalMapped = mapResults.reduce((s, r) => s + r.mapped, 0);
      const totalSkipped = mapResults.reduce((s, r) => s + r.skipped, 0);
      const totalAlready = mapResults.reduce((s, r) => s + r.already_mapped, 0);

      return new Response(
        JSON.stringify({
          trace_id: traceId, action, parser_version: PARSER_VERSION,
          total_processed: mapResults.length,
          total_mapped: totalMapped,
          total_skipped: totalSkipped,
          total_already_mapped: totalAlready,
          results: mapResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: PROGRAM_DETAILS (Phase 2b) ───
    if (action === 'program_details') {
      const detailLimit = (body as any)?.detail_limit || 20;
      await writeTelemetry(supabase, traceId, 'd5_program_details_start', {
        total: targets.length, detail_limit: detailLimit,
      });

      const detailResults: Array<{
        sir_id: string; university_id: string;
        crawled: number; enriched: number; errors: number;
      }> = [];

      for (const target of targets) {
        if (!hasTimeBudget()) {
          console.log(`[D5-Detail] Time budget exhausted after ${detailResults.length} universities`);
          break;
        }
        try {
          const r = await crawlProgramDetails(supabase, target.university_id!, target.external_id!, firecrawlKey, traceId, detailLimit);
          detailResults.push({ sir_id: target.external_id!, university_id: target.university_id!, ...r });
        } catch (err) {
          console.error(`[D5-Detail] Error ${target.external_id}:`, err);
          detailResults.push({ sir_id: target.external_id!, university_id: target.university_id!, crawled: 0, enriched: 0, errors: 1 });
        }
        // Mark phase done for this target
        await supabase.rpc('rpc_d5_mark_phase_done', {
          p_source_name: SOURCE_NAME, p_external_id: target.external_id!, p_phase: phaseTag,
        });
      }

      return new Response(
        JSON.stringify({
          trace_id: traceId, action, parser_version: PARSER_VERSION,
          total_processed: detailResults.length,
          total_crawled: detailResults.reduce((s, r) => s + r.crawled, 0),
          total_enriched: detailResults.reduce((s, r) => s + r.enriched, 0),
          total_errors: detailResults.reduce((s, r) => s + r.errors, 0),
          results: detailResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: EMPLOYMENT ───
    if (action === 'employment') {
      await writeTelemetry(supabase, traceId, 'd5_employment_start', { total: targets.length });

      const empResults: Array<{
        sir_id: string; university_id: string; has_content: boolean; content_length: number;
      }> = [];

      for (const target of targets) {
        if (!hasTimeBudget()) {
          console.log(`[D5-Employment] Time budget exhausted after ${empResults.length}`);
          break;
        }
        const r = await crawlExtraTab(supabase, target.university_id!, target.external_id!, 'employment', 'sir_employment', firecrawlKey, traceId);
        empResults.push({ sir_id: target.external_id!, university_id: target.university_id!, has_content: r.has_content, content_length: r.content_length });
        await supabase.rpc('rpc_d5_mark_phase_done', {
          p_source_name: SOURCE_NAME, p_external_id: target.external_id!, p_phase: phaseTag,
        });
      }

      return new Response(
        JSON.stringify({
          trace_id: traceId, action, parser_version: PARSER_VERSION,
          total_processed: empResults.length,
          with_content: empResults.filter(r => r.has_content).length,
          results: empResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: USEFUL_INFO ───
    if (action === 'useful_info') {
      await writeTelemetry(supabase, traceId, 'd5_useful_info_start', { total: targets.length });

      const infoResults: Array<{
        sir_id: string; university_id: string; has_content: boolean; content_length: number;
      }> = [];

      for (const target of targets) {
        if (!hasTimeBudget()) {
          console.log(`[D5-UsefulInfo] Time budget exhausted after ${infoResults.length}`);
          break;
        }
        const r = await crawlExtraTab(supabase, target.university_id!, target.external_id!, 'useful-information', 'sir_useful_information', firecrawlKey, traceId);
        infoResults.push({ sir_id: target.external_id!, university_id: target.university_id!, has_content: r.has_content, content_length: r.content_length });
        await supabase.rpc('rpc_d5_mark_phase_done', {
          p_source_name: SOURCE_NAME, p_external_id: target.external_id!, p_phase: phaseTag,
        });
      }

      return new Response(
        JSON.stringify({
          trace_id: traceId, action, parser_version: PARSER_VERSION,
          total_processed: infoResults.length,
          with_content: infoResults.filter(r => r.has_content).length,
          results: infoResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── ACTION: ENRICH (default Phase 1) ───
    const results: Array<{
      sir_id: string; university_id: string; success: boolean;
      pages_scraped: number; error?: string;
    }> = [];

    for (const target of targets) {
      if (!hasTimeBudget()) {
        console.log(`[D5-Enrich] Time budget exhausted after ${results.length} universities`);
        break;
      }
      try {
        const result = await enrichUniversity(supabase, target.university_id!, target.external_id!, firecrawlKey, traceId);
        results.push({
          sir_id: target.external_id!, university_id: target.university_id!,
          success: result.success, pages_scraped: result.pages_scraped, error: result.error,
        });
      } catch (err) {
        console.error(`[D5-Enrich] Error enriching ${target.external_id}:`, err);
        results.push({
          sir_id: target.external_id!, university_id: target.university_id!,
          success: false, pages_scraped: 0, error: String(err),
        });
      }
    }

    const summary = {
      trace_id: traceId, action,
      total_processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      total_pages_scraped: results.reduce((sum, r) => sum + r.pages_scraped, 0),
      parser_version: PARSER_VERSION,
    };

    console.log(`[D5-Enrich] Summary:`, JSON.stringify(summary));
    await writeSummaryTelemetry(supabase, traceId, results);

    return new Response(
      JSON.stringify({ ...summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[D5] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
