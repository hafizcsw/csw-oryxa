import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { id: rawId, locale } = await req.json();
    if (!rawId) throw new Error("Missing university id");

    const requestedLocale = locale || null;

    // Detect UUID vs slug and resolve to UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let universityId = rawId;
    if (!uuidRegex.test(rawId)) {
      // Treat as slug — resolve to UUID
      const { data: slugRow, error: slugErr } = await supabase
        .from("universities")
        .select("id")
        .eq("slug", rawId)
        .maybeSingle();
      if (slugErr) throw slugErr;
      if (!slugRow) throw new Error("University not found");
      universityId = slugRow.id;
    }

    console.log(`[get-university-details] Fetching: ${universityId} (input: ${rawId}), locale: ${requestedLocale || 'none'}`);

    // University details
    const { data: uni, error } = await supabase
      .from("vw_university_details")
      .select("*")
      .eq("university_id", universityId)
      .single();

    if (error) throw error;
    if (!uni) throw new Error("University not found");

    console.log(`[get-university-details] Found: ${uni.university_name}`);

    // ===== LOCALE RESOLUTION (backward-compatible) =====
    let localeResolution: any = null;
    if (requestedLocale) {
      try {
        const { data: resolved } = await supabase.rpc('resolve_locale_batch', {
          _entity_type: 'university',
          _entity_id: universityId,
          _field_names: ['name', 'description', 'about_text'],
          _locale: requestedLocale,
          _fallback_locale: 'en',
          _max_quality_tier: 3,
        });

        if (resolved && resolved.length > 0) {
          const fieldMap: Record<string, any> = {};
          for (const r of resolved) {
            if (r.translated_text !== null) {
              fieldMap[r.field_name] = {
                text: r.translated_text,
                locale_served: r.locale_served,
                quality_tier: r.quality_tier,
                fallback_used: r.fallback_used,
                review_status: r.review_status,
              };
            }
          }

          // Also resolve country name
          if (uni.country_id) {
            const { data: countryResolved } = await supabase.rpc('resolve_locale', {
              _entity_type: 'country',
              _entity_id: uni.country_id,
              _field_name: 'name',
              _locale: requestedLocale,
              _fallback_locale: 'en',
              _max_quality_tier: 3,
            });
            if (countryResolved && countryResolved.length > 0 && countryResolved[0].translated_text) {
              fieldMap['country_name'] = {
                text: countryResolved[0].translated_text,
                locale_served: countryResolved[0].locale_served,
                quality_tier: countryResolved[0].quality_tier,
                fallback_used: countryResolved[0].fallback_used,
                review_status: countryResolved[0].review_status,
              };
            }
          }

          const anyFallback = Object.values(fieldMap).some((f: any) => f.fallback_used);
          const servedLocales = [...new Set(Object.values(fieldMap).map((f: any) => f.locale_served))];

          localeResolution = {
            locale_requested: requestedLocale,
            locale_served: servedLocales.length === 1 ? servedLocales[0] : servedLocales,
            fallback_used: anyFallback,
            display: {
              name: fieldMap['name']?.text || uni.university_name,
              description: fieldMap['description']?.text || uni.description_ar || null,
              about_text: fieldMap['about_text']?.text || uni.about_text || null,
              country_name: fieldMap['country_name']?.text || uni.country_name,
            },
            _meta: {
              fields_resolved: Object.keys(fieldMap).length,
              resolution_details: fieldMap,
            },
          };

          console.log(`[get-university-details] Locale resolved: ${JSON.stringify({ requested: requestedLocale, served: servedLocales, fields: Object.keys(fieldMap).length })}`);
        }
      } catch (localeErr) {
        console.log(`[get-university-details] Locale resolution error (non-fatal):`, localeErr);
      }
    }

    // ── Load page settings for visibility enforcement ──
    const { data: pageSettings } = await supabase
      .from("university_page_settings")
      .select("key, value")
      .eq("university_id", universityId);
    const settingsMap: Record<string, boolean> = {};
    for (const s of (pageSettings || [])) {
      // DB stores value as string "true"/"false" — normalize to boolean
      settingsMap[s.key] = s.value === true || s.value === "true";
    }

    // Programs — only published + active (Part 3: no draft/hidden leakage)
    let programs: any[] = [];
    if (settingsMap.programs_visible !== false) {
      const { data: programsData } = await supabase
        .from("programs")
        .select(`
          id, title, degree_level, degree_id,
          tuition_yearly, currency_code, tuition_is_free,
          duration_months,
          language, languages,
          delivery_mode, study_mode,
          ielts_required, ielts_min_overall, ielts_min_each_section,
          toefl_required, toefl_min,
          gpa_required, gpa_min,
          next_intake_date, intake_months,
          has_scholarship, scholarship_type, scholarship_percent_coverage,
          scholarship_amount_usd, scholarship_monthly_stipend_usd,
          scholarship_covers_housing, scholarship_covers_insurance,
          required_documents,
          entrance_exam_required, entrance_exam_types,
          employment_rate, avg_salary, enrolled_students,
          has_internship, is_accredited,
          foundation_required, prep_year_required, interview_required,
          accepted_certificates, additional_requirements,
          application_fee, description, city,
          publish_status, is_active,
          seats_status, seats_available, application_deadline
        `)
        .eq("university_id", universityId)
        .eq("publish_status", "published")
        .eq("is_active", true)
        .order("title", { ascending: true });
      programs = programsData || [];
    }

    // Scholarships — respect scholarships_visible setting
    let scholarships: any[] = [];
    if (settingsMap.scholarships_visible !== false) {
      const { data: scholarshipsData } = await supabase
        .from("scholarships")
        .select("*")
        .eq("university_id", universityId)
        .eq("status", "published")
        .order("deadline", { ascending: true });
      scholarships = scholarshipsData || [];
    }

    // Admissions
    const { data: admissions } = await supabase
      .from("admissions_consensus")
      .select("*")
      .eq("university_id", universityId)
      .eq("audience", "international")
      .order("degree_level", { ascending: true });

    // Housing
    const { data: housing } = await supabase
      .from("university_housing")
      .select("*")
      .eq("university_id", universityId);

    // Housing locations (for map — up to 20)
    const { data: housingLocations } = await supabase
      .from("university_housing_locations")
      .select("id, name, address, lat, lon, price_monthly_local, currency_code, is_primary, status")
      .eq("university_id", universityId)
      .in("status", ["verified", "discovered"])
      .order("is_primary", { ascending: false })
      .limit(20);

    // University geo coordinates (from universities table directly)
    const { data: uniGeo } = await supabase
      .from("universities")
      .select("geo_lat, geo_lon, geo_source, geo_confidence, city, country_code, name")
      .eq("id", universityId)
      .single();

    let resolvedGeoLat: number | null = uniGeo?.geo_lat ?? null;
    let resolvedGeoLon: number | null = uniGeo?.geo_lon ?? null;
    let resolvedGeoSource: string | null = uniGeo?.geo_source ?? null;

    // Fallback #1: latest resolved coordinates from verification rows
    if (resolvedGeoLat == null || resolvedGeoLon == null) {
      const { data: verifiedGeo } = await supabase
        .from("geo_verification_rows")
        .select("resolved_lat, resolved_lon, resolution_source, confidence, processed_at, created_at")
        .eq("university_id", universityId)
        .not("resolved_lat", "is", null)
        .not("resolved_lon", "is", null)
        .order("processed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verifiedGeo?.resolved_lat != null && verifiedGeo?.resolved_lon != null) {
        resolvedGeoLat = verifiedGeo.resolved_lat;
        resolvedGeoLon = verifiedGeo.resolved_lon;
        resolvedGeoSource = verifiedGeo.resolution_source ? `verified:${verifiedGeo.resolution_source}` : "verified";
      }
    }

    // Fallback #2: explicit city value
    if ((resolvedGeoLat == null || resolvedGeoLon == null) && (uniGeo?.city || uni?.city)) {
      const cityHint = (uniGeo?.city || uni?.city || "").trim();
      if (cityHint) {
        let { data: cityCoord } = await supabase
          .from("city_coordinates")
          .select("city_name, lat, lon, country_code")
          .ilike("city_name", cityHint)
          .limit(1)
          .maybeSingle();

        if (!cityCoord) {
          const { data: cityCoordLike } = await supabase
            .from("city_coordinates")
            .select("city_name, lat, lon, country_code")
            .ilike("city_name", `%${cityHint}%`)
            .limit(1)
            .maybeSingle();
          cityCoord = cityCoordLike || null;
        }

        if (cityCoord?.lat != null && cityCoord?.lon != null) {
          resolvedGeoLat = cityCoord.lat;
          resolvedGeoLon = cityCoord.lon;
          resolvedGeoSource = "city_center";
        }
      }
    }

    // Fallback #3: infer city from university name tokens
    if (resolvedGeoLat == null || resolvedGeoLon == null) {
      const sourceText = [uniGeo?.name, uni?.university_name, uni?.university_name_en, uni?.university_name_ar]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const stopWords = new Set([
        "university", "state", "technological", "technology", "institute", "college", "academy", "federal",
        "national", "school", "higher", "education", "of", "for", "and", "the", "saint", "st", "city"
      ]);

      const tokens = Array.from(
        new Set((sourceText.match(/[a-z]{4,}/g) || []).filter(token => !stopWords.has(token)))
      ).slice(0, 8);

      if (tokens.length > 0) {
        const orFilter = tokens.map(token => `city_name.ilike.%${token}%`).join(",");
        const { data: tokenCityMatches } = await supabase
          .from("city_coordinates")
          .select("city_name, lat, lon, country_code")
          .or(orFilter)
          .limit(30);

        if (tokenCityMatches && tokenCityMatches.length > 0) {
          const normalize = (v: string) =>
            v
              .toLowerCase()
              .replace(/saint/g, "st")
              .replace(/[.,/()\-]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

          const normalizedSource = normalize(sourceText);

          const ranked = tokenCityMatches
            .map((candidate) => {
              const cityNorm = normalize(candidate.city_name);
              let score = 0;
              if (normalizedSource.includes(cityNorm)) score += 10;
              for (const token of tokens) {
                if (cityNorm.includes(token)) score += 2;
              }
              return { ...candidate, score };
            })
            .sort((a, b) => b.score - a.score);

          const best = ranked[0];
          if (best && best.lat != null && best.lon != null) {
            resolvedGeoLat = best.lat;
            resolvedGeoLon = best.lon;
            resolvedGeoSource = "city_name_inferred";
          }
        }
      }
    }

    // Dorm images
    const { data: dormImages } = await supabase
      .from("university_media")
      .select("public_url, source_url, alt_text")
      .eq("university_id", universityId)
      .eq("image_type", "dormitory")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .limit(20);

    // Gallery images
    const { data: galleryMedia } = await supabase
      .from("university_media")
      .select("public_url, source_url")
      .eq("university_id", universityId)
      .eq("image_type", "gallery")
      .order("is_primary", { ascending: false, nullsFirst: false })
      .order("sort_order", { ascending: true, nullsFirst: false })
      .limit(20);

    let galleryImages = (galleryMedia || []).map(m => m.public_url || m.source_url).filter(Boolean);

    // Fallback: QS media
    if (galleryImages.length === 0) {
      const { data: qsEntity } = await supabase
        .from("qs_entity_profiles")
        .select("id")
        .eq("university_id", universityId)
        .limit(1)
        .single();

      if (qsEntity) {
        const { data: qsMedia } = await supabase
          .from("qs_media_assets")
          .select("photo_assets")
          .eq("entity_profile_id", qsEntity.id)
          .single();

        if (qsMedia?.photo_assets && Array.isArray(qsMedia.photo_assets)) {
          galleryImages = qsMedia.photo_assets.slice(0, 20);
        }
      }
    }

    // Hero fallback
    if (!uni.hero_image_url && !uni.main_image_url && galleryImages.length > 0) {
      uni.hero_image_url = galleryImages[0];
      if (galleryImages.length > 1) uni.main_image_url = galleryImages[1];
    }

    // ===== SIMILAR UNIVERSITIES =====
    let similarUniversities: any[] = [];
    try {
      const { data: similar } = await supabase
        .from("universities")
        .select("id, name, name_ar, name_en, city, logo_url, hero_image_url, main_image_url, qs_world_rank, country_id, countries!inner(name_ar, slug)")
        .eq("countries.slug", uni.country_slug)
        .neq("id", universityId)
        .order("qs_world_rank", { ascending: true, nullsFirst: false })
        .limit(20);

      const withImages = (similar || []).filter((s: any) => s.hero_image_url || s.main_image_url || s.logo_url);
      const withoutImages = (similar || []).filter((s: any) => !s.hero_image_url && !s.main_image_url && !s.logo_url);
      const sorted = [...withImages, ...withoutImages].slice(0, 6);

      const uniIds = sorted.map((s: any) => s.id);
      const { data: progCounts } = await supabase
        .from("programs")
        .select("university_id")
        .in("university_id", uniIds)
        .eq("is_active", true);

      const countMap: Record<string, number> = {};
      (progCounts || []).forEach((p: any) => {
        countMap[p.university_id] = (countMap[p.university_id] || 0) + 1;
      });

      similarUniversities = sorted.map((s: any) => ({
        id: s.id,
        name: s.name || s.name_ar || s.name_en,
        city: s.city,
        country_name: (s.countries as any)?.name_ar || uni.country_name,
        logo_url: s.logo_url,
        image_url: s.hero_image_url || s.main_image_url,
        qs_rank: s.qs_world_rank,
        programs_count: countMap[s.id] || null,
      }));
    } catch (e) {
      console.log("[get-university-details] Similar universities error:", e);
    }

    console.log(`[get-university-details] Programs: ${programs?.length || 0}, Similar: ${similarUniversities.length}`);

    // Build response — backward-compatible: old shape preserved, locale data added when requested
    const uniItem = { ...uni, galleryImages, geo_lat: resolvedGeoLat, geo_lon: resolvedGeoLon, geo_source: resolvedGeoSource || null };

    // Strip contact info from public response when contact_visible is false
    if (settingsMap.contact_visible === false) {
      delete uniItem.phone;
      delete uniItem.email;
      delete uniItem.website;
      delete uniItem.website_url;
      delete uniItem.whatsapp;
      delete uniItem.social_links;
    }

    const response: any = {
      ok: true,
      item: uniItem,
      programs: programs,
      scholarships: scholarships,
      admissions: admissions || [],
      pageSettings: { posts_visible: settingsMap.posts_visible !== false, programs_visible: settingsMap.programs_visible !== false, scholarships_visible: settingsMap.scholarships_visible !== false, contact_visible: settingsMap.contact_visible !== false, auto_publish: settingsMap.auto_publish !== false },
      housing: housing || [],
      housingLocations: housingLocations || [],
      dormImages: (dormImages || []).map(d => d.public_url || d.source_url).filter(Boolean),
      similarUniversities,
    };

    // Add locale resolution when requested (additive, never breaks old consumers)
    if (localeResolution) {
      response.locale = localeResolution;
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error("[get-university-details] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
