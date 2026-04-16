import { useState, useMemo, useCallback, memo, useEffect, useRef } from "react";
import { WorldMapLeaflet, type LeafletMapHandle, type MapViewport } from "./WorldMapLeaflet";
import { MapUniversitySearch } from "./MapUniversitySearch";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, GraduationCap, Search, Globe, X,
  Building2, DollarSign, ChevronRight, Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMapFilters } from "@/hooks/useMapFilters";
import {
  useMapCountrySummary,
  useMapCountryUniversities,
  type CitySummary,
} from "@/hooks/useMapData";
import { useOsmCityOverlay } from "@/hooks/useOsmCityOverlay";
import {
  getCachedCountryGeodata,
  loadCountryGeodata,
  hasCountryGeodata,
} from "@/lib/countryGeodata";
import { useGeoCacheResolver } from "@/hooks/useGeoCacheResolver";
import { useUniversityGeoResolver } from "@/hooks/useUniversityGeoResolver";
import { cityKey, uniKey } from "@/lib/geoResolver";
import {
  mapCitiesToRegions,
  buildRegionSummaries,
  filterUniversitiesByRegion,
  type RegionSummary,
} from "@/lib/regionMapping";

/* ── Region grouping (visual filter only) ── */
const REGIONS: Record<string, { labelKey: string; codes: string[] }> = {
  asia: {
    labelKey: "home.worldMap.regions.asia",
    codes: ["CN","JP","KR","IN","PK","ID","MY","TH","VN","PH","IR","IQ","SA","AE","QA","KW","BH","OM","JO","LB","SY","YE","AF","BD","LK","NP","MM","KH","LA","SG","BN","TW","MN","KZ","UZ","TM","KG","TJ","GE","AM","AZ","PS"],
  },
  europe: {
    labelKey: "home.worldMap.regions.europe",
    codes: ["RU","DE","FR","GB","IT","ES","PL","UA","NL","BE","SE","NO","DK","FI","AT","CH","CZ","PT","GR","HU","RO","BG","HR","SK","IE","LT","LV","EE","SI","RS","BA","AL","MK","ME","MD","BY","IS","MT","CY","LU"],
  },
  africa: {
    labelKey: "home.worldMap.regions.africa",
    codes: ["EG","NG","ZA","MA","TN","DZ","KE","GH","ET","TZ","UG","SN","CM","CI","MG","MZ","AO","SD","LY","ZW","ZM","BW","NA","RW","ML"],
  },
  north_america: {
    labelKey: "home.worldMap.regions.northAmerica",
    codes: ["US","CA","MX","GT","CU","HN","SV","NI","CR","PA","JM","HT","DO","TT","BS"],
  },
  south_america: {
    labelKey: "home.worldMap.regions.southAmerica",
    codes: ["BR","AR","CO","PE","VE","CL","EC","BO","PY","UY","GY","SR"],
  },
  oceania: {
    labelKey: "home.worldMap.regions.oceania",
    codes: ["AU","NZ","FJ","PG","WS"],
  },
};

const DEGREE_GROUPS = [
  { value: "bachelor", labelKey: "home.worldMap.degrees.bachelor" },
  { value: "master", labelKey: "home.worldMap.degrees.master" },
  { value: "phd", labelKey: "home.worldMap.degrees.phd" },
];

type DrillLevel = "world" | "country" | "city";

export const WorldMapSection = memo(function WorldMapSection() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const isRtl = ["ar", "fa", "ur", "he"].includes(language);

  // ── State ──
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("world");
  const [showAllUnis, setShowAllUnis] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [viewMode] = useState<"flat">("flat");
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [manualCitySelection, setManualCitySelection] = useState(false);
  const mapLeafletRef = useRef<LeafletMapHandle>(null);
  const getLocalizedValue = useCallback((record: Record<string, unknown>, keyPrefix: string) => {
    const byActiveLanguage = record[`${keyPrefix}_${language}`];
    if (typeof byActiveLanguage === "string" && byActiveLanguage.trim()) return byActiveLanguage;
    const englishValue = record[`${keyPrefix}_en`];
    if (typeof englishValue === "string" && englishValue.trim()) return englishValue;
    const arabicValue = record[`${keyPrefix}_ar`];
    if (typeof arabicValue === "string" && arabicValue.trim()) return arabicValue;
    return "";
  }, [language]);

  // Geodata state (kept for map borders)
  const [subdivisionGeodata, setSubdivisionGeodata] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loadingGeodata, setLoadingGeodata] = useState(false);

  const {
    filters, rpcParams, setRegion, setDegreeSlug, setFeesMax, DEFAULT_FEES_MAX,
  } = useMapFilters();

  // ── Data ──
  const { data: countryMeta } = useQuery({
    queryKey: ["country-meta"],
    queryFn: async () => {
      const { data } = await supabase
        .from("countries")
        .select("country_code, slug, name_ar, name_en, image_url");
      const map: Record<string, { slug: string; name_ar: string; name_en: string | null; image_url: string | null }> = {};
      (data || []).forEach((c) => {
        const code = c.country_code?.toUpperCase();
        if (code) map[code] = { slug: c.slug, name_ar: c.name_ar, name_en: c.name_en, image_url: c.image_url };
      });
      return map;
    },
    staleTime: 30 * 60_000,
  });

  const { data: countryStats, isFetching: isFetchingStats } = useMapCountrySummary(rpcParams);
  const { data: countryUniversities, isLoading: loadingUnis } = useMapCountryUniversities(
    selectedCountryCode,
    rpcParams,
    drillLevel !== "world"
  );

  const derivedCountryCities = useMemo<CitySummary[]>(() => {
    if (!countryUniversities || countryUniversities.length === 0) return [];

    const byCity = new Map<string, {
      city: string;
      universities: Set<string>;
      programs_count: number;
      fee_min: number | null;
      fee_max: number | null;
      lat_sum: number;
      lon_sum: number;
      latlon_count: number;
    }>();

    for (const uni of countryUniversities) {
      const rawCity = uni.city?.trim();
      const city = rawCity && rawCity.length > 0 ? rawCity : "__unknown__";
      const key = city.toLowerCase();

      if (!byCity.has(key)) {
        byCity.set(key, {
          city,
          universities: new Set<string>(),
          programs_count: 0,
          fee_min: null,
          fee_max: null,
          lat_sum: 0,
          lon_sum: 0,
          latlon_count: 0,
        });
      }

      const cityAgg = byCity.get(key)!;
      cityAgg.universities.add(uni.university_id);
      cityAgg.programs_count += Number(uni.programs_count || 0);

      if (typeof uni.fee_min === "number") {
        cityAgg.fee_min = cityAgg.fee_min == null ? uni.fee_min : Math.min(cityAgg.fee_min, uni.fee_min);
      }
      if (typeof uni.fee_max === "number") {
        cityAgg.fee_max = cityAgg.fee_max == null ? uni.fee_max : Math.max(cityAgg.fee_max, uni.fee_max);
      }

      if (typeof uni.geo_lat === "number" && typeof uni.geo_lon === "number") {
        cityAgg.lat_sum += uni.geo_lat;
        cityAgg.lon_sum += uni.geo_lon;
        cityAgg.latlon_count += 1;
      }
    }

    return [...byCity.values()]
      .map((cityAgg) => ({
        city: cityAgg.city,
        universities_count: cityAgg.universities.size,
        programs_count: cityAgg.programs_count,
        fee_min: cityAgg.fee_min,
        fee_max: cityAgg.fee_max,
        city_lat: cityAgg.latlon_count > 0 ? Number((cityAgg.lat_sum / cityAgg.latlon_count).toFixed(6)) : null,
        city_lon: cityAgg.latlon_count > 0 ? Number((cityAgg.lon_sum / cityAgg.latlon_count).toFixed(6)) : null,
      }))
      .sort((a, b) => b.universities_count - a.universities_count);
  }, [countryUniversities]);

  const effectiveCountryCities = useMemo<CitySummary[]>(() => {
    return derivedCountryCities;
  }, [derivedCountryCities]);

  // ── Geo cache: resolve missing city coordinates and persist ──
  const { resolved: geoCacheResolved, isResolving: geoCacheResolving } = useGeoCacheResolver(
    effectiveCountryCities,
    selectedCountryCode
  );

  // Merge geo cache results into effective cities
  const geoEnrichedCities = useMemo<CitySummary[]>(() => {
    if (geoCacheResolved.size === 0 || !selectedCountryCode) return effectiveCountryCities;
    return effectiveCountryCities.map(city => {
      if (city.city_lat != null && city.city_lon != null) return city;
      const key = cityKey(selectedCountryCode, city.city);
      const cached = geoCacheResolved.get(key);
      if (cached) {
        return { ...city, city_lat: cached.lat, city_lon: cached.lon };
      }
      return city;
    });
  }, [effectiveCountryCities, geoCacheResolved, selectedCountryCode]);

  const countryLevelLoading = geoEnrichedCities.length === 0 && loadingUnis;

  const filteredCodes = useMemo(() => {
    if (filters.region === "all") return null;
    return new Set(REGIONS[filters.region]?.codes || []);
  }, [filters.region]);

  const hasData = useCallback(
    (code: string) => !!countryStats?.[code] && countryStats[code].universities_count > 0,
    [countryStats]
  );

  // ── Load subdivision geodata when country selected ──
  useEffect(() => {
    if (!selectedCountryCode || drillLevel === "world") {
      setSubdivisionGeodata(null);
      setLoadingGeodata(false);
      return;
    }

    if (!hasCountryGeodata(selectedCountryCode)) {
      setSubdivisionGeodata(null);
      setLoadingGeodata(false);
      return;
    }

    const cachedGeodata = getCachedCountryGeodata(selectedCountryCode);
    if (cachedGeodata) {
      setSubdivisionGeodata(cachedGeodata);
      setLoadingGeodata(false);
      return;
    }

    let cancelled = false;
    setSubdivisionGeodata(null);
    setLoadingGeodata(true);
    loadCountryGeodata(selectedCountryCode).then((data) => {
      if (!cancelled) {
        setSubdivisionGeodata(data);
        setLoadingGeodata(false);
      }
    }).catch((err) => {
      console.error("[Map] Geodata load error:", err);
      if (!cancelled) {
        setSubdivisionGeodata(null);
        setLoadingGeodata(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedCountryCode, drillLevel]);

  // ── Map cities to regions (kept for map layer compatibility) ──
  const { regionSummaries, cityToRegion } = useMemo(() => {
    if (!subdivisionGeodata || geoEnrichedCities.length === 0) {
      return { regionSummaries: [] as RegionSummary[], cityToRegion: {} as Record<string, string[]> };
    }
    const mapping = mapCitiesToRegions(geoEnrichedCities, subdivisionGeodata);
    const summaries = buildRegionSummaries(geoEnrichedCities, subdivisionGeodata, mapping);
    return { regionSummaries: summaries, cityToRegion: mapping };
  }, [subdivisionGeodata, geoEnrichedCities]);

  // ── Universities in selected city ──
  const cityUniversities = useMemo(() => {
    if (!selectedCity || !countryUniversities) return [];

    if (selectedCity === "__unknown__") {
      return countryUniversities.filter((u) => !u.city || u.city.trim().length === 0);
    }

    return countryUniversities.filter(
      u => u.city && u.city.toLowerCase() === selectedCity.toLowerCase()
    );
  }, [selectedCity, countryUniversities]);

  // ── Selected city summary ──
  const selectedCitySummary = useMemo(() => {
    if (!selectedCity || geoEnrichedCities.length === 0) return null;
    return geoEnrichedCities.find(c => c.city?.toLowerCase() === selectedCity.toLowerCase()) || null;
  }, [selectedCity, geoEnrichedCities]);

  // ── University geo resolution: resolve missing coordinates and persist globally ──
  const { resolved: uniGeoResolved } = useUniversityGeoResolver(
    cityUniversities,
    selectedCountryCode,
    drillLevel === "city" && cityUniversities.length > 0
  );

  // Merge resolved university coordinates into city universities
  const geoEnrichedCityUnis = useMemo(() => {
    if (uniGeoResolved.size === 0) return cityUniversities;
    return cityUniversities.map(u => {
      if (u.geo_lat != null && u.geo_lon != null) return u;
      const cached = uniGeoResolved.get(uniKey(u.university_id));
      if (cached) {
        return { ...u, geo_lat: cached.lat, geo_lon: cached.lon, geo_source: cached.source };
      }
      return u;
    });
  }, [cityUniversities, uniGeoResolved]);

  // ── OSM City Overlay: verified university positions ──
  const { data: osmOverlay, isLoading: osmOverlayLoading } = useOsmCityOverlay(
    selectedCity,
    selectedCountryCode,
    selectedCitySummary?.city_lat ?? null,
    selectedCitySummary?.city_lon ?? null,
    geoEnrichedCityUnis,
    drillLevel === "city" && geoEnrichedCityUnis.length > 0
  );

  // ── Navigation callbacks ──
  const handleBackToWorld = useCallback(() => {
    setSelectedCountryCode(null);
    setSelectedCity(null);
    setDrillLevel("world");
    setShowAllUnis(false);
    setManualCitySelection(false);
  }, []);

  const handleCountryClick = useCallback((code: string) => {
    if (!hasData(code)) return;
    if (selectedCountryCode === code && drillLevel === "country") {
      return;
    }
    setSelectedCity(null);
    setSelectedCountryCode(code);
    setDrillLevel("country");
    setShowAllUnis(false);
    setManualCitySelection(false);
  }, [hasData, selectedCountryCode, drillLevel]);

  const handleCityClick = useCallback((cityName: string) => {
    setSelectedCity(cityName);
    setDrillLevel("city");
    setShowAllUnis(false);
    setManualCitySelection(true);
  }, []);

  const handleBackToCountry = useCallback(() => {
    setSelectedCity(null);
    setDrillLevel("country");
    setShowAllUnis(false);
    setManualCitySelection(false);
  }, []);

  const selectedCountryInfo = selectedCountryCode ? countryStats?.[selectedCountryCode] : null;
  const selectedMeta = selectedCountryCode ? countryMeta?.[selectedCountryCode] : null;

  // Find region for selected city (for map compat)
  const selectedRegionForCity = useMemo(() => {
    if (!selectedCity) return null;
    const region = regionSummaries.find(r =>
      r.cities.some(c => c.toLowerCase() === selectedCity.toLowerCase())
    );
    return region || null;
  }, [selectedCity, regionSummaries]);

  // ── Breadcrumb ──
  const breadcrumb = useMemo(() => {
    const items: { label: string; onClick: () => void }[] = [
      { label: `🌍 ${t("home.worldMap.section.world")}`, onClick: handleBackToWorld },
    ];
    if (selectedCountryInfo) {
      const name = getLocalizedValue(selectedCountryInfo as unknown as Record<string, unknown>, "country_name");
      items.push({
        label: name,
        onClick: drillLevel === "city" ? handleBackToCountry : () => {},
      });
    }
    if (selectedCity && drillLevel === "city") {
      items.push({ label: selectedCity, onClick: () => {} });
    }
    return items;
  }, [selectedCountryInfo, selectedCity, drillLevel, getLocalizedValue, handleBackToWorld, handleBackToCountry]);

  // ── Let the map drive the active country from the real geometry under the viewport ──
  useEffect(() => {
    if (manualCitySelection || !mapViewport || !countryStats) return;
    if (drillLevel !== "world") return;
    if (mapViewport.zoom < 5) return;

    const activeCountryCode = mapViewport.activeCountryCode;
    if (!activeCountryCode) return;

    const activeCountryStats = countryStats[activeCountryCode];
    if (!activeCountryStats || activeCountryStats.universities_count === 0) return;

    if (selectedCountryCode === activeCountryCode) return;

    setSelectedCountryCode(activeCountryCode);
    setSelectedCity(null);
    setDrillLevel("country");
    setShowAllUnis(false);
  }, [mapViewport, countryStats, manualCitySelection, selectedCountryCode, drillLevel]);

  // ── Viewport-based visible cities filtering ──
  const visibleCities = useMemo(() => {
    if (!mapViewport || drillLevel !== "country") return geoEnrichedCities;
    if (mapViewport.zoom < 4) return geoEnrichedCities; // Too zoomed out, show all
    return geoEnrichedCities.filter(city => {
      if (city.city_lat == null || city.city_lon == null) return true; // Keep cities without coords visible
      return mapViewport.bounds.contains([city.city_lat, city.city_lon] as [number, number]);
    });
  }, [geoEnrichedCities, mapViewport, drillLevel]);

  // ── Auto-drill to city when zoomed in close and only 1 city visible ──
  useEffect(() => {
    if (drillLevel !== "country" || manualCitySelection) return;
    if (!mapViewport || mapViewport.zoom < 10) return;
    const candidateCities = visibleCities.filter(c => c.city !== "__unknown__");
    if (candidateCities.length === 1) {
      setSelectedCity(candidateCities[0].city);
      setDrillLevel("city");
    }
  }, [mapViewport, visibleCities, drillLevel, manualCitySelection]);

  // ── Viewport change handler (stable ref) ──
  const handleViewportChange = useCallback((viewport: MapViewport) => {
    setMapViewport(viewport);
  }, []);

  return (
    <section className="relative">
      {/* ── Visual Separator + Section Header ── */}
      <div className="relative z-[1010] bg-gradient-to-b from-muted/60 via-background/80 to-background border-t border-border/50 shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
          <div className="text-center space-y-3 mb-6">
            {/* Glassmorphism Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 text-primary text-xs font-semibold tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {t("home.worldMap.section.exploreWorldwide")}
            </div>

            {/* Animated Globe Icon */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
              <Globe className="h-7 w-7 text-primary animate-[spin_20s_linear_infinite]" />
            </div>

            {/* Gradient Title */}
            <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              {t("home.worldMap.section.exploreStudyDestinations")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t("home.worldMap.section.selectCountryOrUseFilters")}
            </p>
          </div>

          {/* ── Filter Bar ── */}
          <div className="relative bg-card/80 backdrop-blur-xl border-2 border-border rounded-xl p-3 shadow-md z-[1100]">
            {/* Top gradient line */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filters.region} onValueChange={setRegion}>
                <SelectTrigger className="flex-1 min-w-[140px] max-w-[220px] h-10 bg-background border border-border text-sm text-foreground rounded-lg">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0 me-1.5" />
                    <SelectValue placeholder={t("home.worldMap.filters.region")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("home.worldMap.filters.allRegions")}</SelectItem>
                  {Object.entries(REGIONS).map(([key, r]) => (
                    <SelectItem key={key} value={key}>{t(r.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.degree_slug} onValueChange={setDegreeSlug}>
                <SelectTrigger className="flex-1 min-w-[140px] max-w-[220px] h-10 bg-background border border-border text-sm text-foreground rounded-lg">
                  <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0 me-1.5" />
                    <SelectValue placeholder={t("home.worldMap.filters.degreeLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("home.worldMap.filters.allLevels")}</SelectItem>
                  {DEGREE_GROUPS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{t(d.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 min-w-[200px] max-w-[280px] flex-1 h-10">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider value={[filters.fees_max]} onValueChange={([v]) => setFeesMax(v)} min={1000} max={50000} step={1000} className="flex-1" />
                <span className="text-xs font-semibold min-w-[55px] text-end text-foreground">${filters.fees_max.toLocaleString()}</span>
              </div>

              <MapUniversitySearch
                isRtl={isRtl}
                onSelect={(uni) => {
                  if (uni.geo_lat != null && uni.geo_lon != null) {
                    // Fly to university location
                    if (uni.country_code) {
                      const cc = uni.country_code.toUpperCase() === "IL" ? "PS" : uni.country_code.toUpperCase();
                      setSelectedCountryCode(cc);
                      if (uni.city) {
                        setSelectedCity(uni.city);
                        setDrillLevel("city");
                      } else {
                        setDrillLevel("country");
                      }
                    }
                    // Delay flyTo to let drill state + markers render first
                    setTimeout(() => {
                      mapLeafletRef.current?.flyTo(uni.geo_lat!, uni.geo_lon!, 13);
                    }, 400);
                  }
                }}
              />

              <Button
                className="gap-2 ms-auto bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-10 px-6 rounded-lg"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedCountryCode && selectedMeta) params.set("country", selectedMeta.slug);
                  if (filters.degree_slug !== "all") params.set("degree", filters.degree_slug);
                  if (filters.fees_max < DEFAULT_FEES_MAX) params.set("fees_max", String(filters.fees_max));
                  navigate(`/search?${params.toString()}`);
                }}
              >
                <Search className="h-4 w-4" />
                {t("home.worldMap.actions.search")}
              </Button>
            </div>

            {/* ── Dynamic Stats Summary ── */}
            {countryStats && drillLevel === "world" && (() => {
              const entries = Object.entries(countryStats).filter(([code, v]) => {
                if (v.universities_count === 0) return false;
                if (filteredCodes && !filteredCodes.has(code)) return false;
                return true;
              });
              const totalCountries = entries.length;
              const totalUnis = entries.reduce((s, [, v]) => s + v.universities_count, 0);
              const totalPrograms = entries.reduce((s, [, v]) => s + v.programs_count, 0);
              return (
                <div className="flex items-center gap-2 mt-2.5 px-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                    <Globe className="h-3 w-3" />
                    {totalCountries} {t("home.worldMap.stats.countries")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-info/10 border border-info/20 text-xs font-semibold text-info">
                    <Building2 className="h-3 w-3" />
                    {totalUnis.toLocaleString()} {t("home.worldMap.labels.universities")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success">
                    <GraduationCap className="h-3 w-3" />
                    {totalPrograms.toLocaleString()} {t("home.worldMap.labels.programs")}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      {drillLevel !== "world" && (
        <div className="bg-card/80 backdrop-blur-sm border-b border-border px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 text-sm">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 rtl:rotate-180" />}
                {i < breadcrumb.length - 1 ? (
                  <button className="text-primary hover:underline font-medium transition-colors" onClick={item.onClick}>
                    {item.label}
                  </button>
                ) : (
                  <span className="text-foreground font-semibold">{item.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Map + Sidebar ── */}
      <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row border-2 border-border rounded-2xl overflow-hidden shadow-[0_8px_40px_-10px_hsl(var(--primary)/0.15),0_4px_20px_-5px_rgba(0,0,0,0.1)] md:h-[560px] lg:h-[700px] mb-6">
        {/* Map Area — dark ocean bg */}
        <div className="relative flex-1 min-w-0 h-[400px] sm:h-[460px] md:h-auto" style={{ background: '#0a1628' }}>

          {drillLevel !== "world" && (
            <button
              className="absolute top-4 start-4 z-[1001] bg-white/10 backdrop-blur-md rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/90 hover:bg-white/20 transition-all border border-white/15"
              onClick={drillLevel === "city" ? handleBackToCountry : handleBackToWorld}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("home.worldMap.actions.back")}
            </button>
          )}

          {/* Loading overlay when filters are updating */}
          {isFetchingStats && drillLevel === "world" && (
            <div className="absolute top-4 start-16 z-[1001] bg-card/80 backdrop-blur-md rounded-lg shadow-lg px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-foreground border border-border">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {t("home.worldMap.status.updating")}
            </div>
          )}

          <WorldMapLeaflet
              ref={mapLeafletRef}
              countryStats={countryStats}
              onCountrySelect={(code) => {
                if (!code) {
                  handleBackToWorld();
                } else {
                  handleCountryClick(code);
                }
              }}
              onCitySelect={handleCityClick}
              onRegionSelect={(regionId) => {
                const region = regionSummaries.find(r => r.regionId === regionId);
                if (region && region.cities.length > 0) {
                  handleCityClick(region.cities[0]);
                }
              }}
              onBackToCountry={handleBackToCountry}
              onBackToWorld={handleBackToWorld}
              onViewportChange={handleViewportChange}
              selectedCountryCode={selectedCountryCode}
              selectedRegionId={selectedRegionForCity?.regionId || null}
              drillLevel={drillLevel === "city" ? "region" : drillLevel}
              isRtl={isRtl}
              subdivisionGeodata={subdivisionGeodata}
              regionSummaries={regionSummaries}
              visibleCountryCodes={filteredCodes}
              citySummaries={geoEnrichedCities.length > 0 ? geoEnrichedCities : undefined}
              cityUniversities={countryUniversities || undefined}
              regionCities={selectedCity ? [selectedCity] : selectedRegionForCity?.cities}
               osmOverlay={osmOverlay}
               osmOverlayLoading={osmOverlayLoading}
               countryMeta={countryMeta}
            />

          {/* Loading indicator for geodata */}
          {loadingGeodata && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
              <Loader2 className="h-8 w-8 animate-spin text-info" />
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className={cn(
          "w-full md:w-[260px] lg:w-[400px] shrink-0 bg-card/95 backdrop-blur-sm border-s-2 border-border flex flex-col overflow-auto transition-all duration-300",
          drillLevel === "world" && "md:w-[240px] lg:w-[360px]",
          "max-h-[45vh] md:max-h-none"
        )}>
          {/* ── CITY LEVEL: Universities in selected city ── */}
          {drillLevel === "city" && selectedCountryInfo && selectedCity && (() => {
            const INITIAL_SHOW = 20;
            const allUnis = cityUniversities;
            const totalCount = allUnis.length;
            const displayedUnis = showAllUnis ? allUnis : allUnis.slice(0, INITIAL_SHOW);
            const hasMore = totalCount > INITIAL_SHOW && !showAllUnis;

            return (
              <>
                {/* City Header */}
                <div className="p-5 border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
                  <button className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-3 font-medium transition-colors" onClick={handleBackToCountry}>
                    <ChevronRight className="h-3 w-3 rotate-180 rtl:rotate-0" />
                    {getLocalizedValue(selectedCountryInfo as unknown as Record<string, unknown>, "country_name")}
                  </button>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-foreground flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                          <MapPin className="h-4.5 w-4.5 text-primary" />
                        </div>
                        {selectedCity}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 ms-[46px]">
                        {selectedCitySummary?.universities_count || totalCount} {t("home.worldMap.labels.universities")}
                        {" · "}
                        {selectedCitySummary?.programs_count || 0} {t("home.worldMap.labels.programs")}
                        {selectedCitySummary?.fee_min != null && selectedCitySummary?.fee_max != null && (
                          <span className="text-muted-foreground/70">
                            {" · "}💰 ${selectedCitySummary.fee_min.toLocaleString()} – ${selectedCitySummary.fee_max.toLocaleString()}
                          </span>
                        )}
                      </p>
                      {/* OSM overlay status */}
                      {osmOverlay && osmOverlay.size > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 ms-[46px]">
                          📍 {[...osmOverlay.values()].filter(m => m.match_status === 'matched').length} {t("home.worldMap.status.verifiedLocations")}
                          {[...osmOverlay.values()].filter(m => m.match_status !== 'matched').length > 0 && (
                            <span className="text-muted-foreground/40">
                              {' · '}{[...osmOverlay.values()].filter(m => m.match_status !== 'matched').length} {t("home.worldMap.status.unverified")}
                            </span>
                          )}
                        </p>
                      )}
                      {osmOverlayLoading && (
                        <p className="text-[10px] text-primary/60 mt-0.5 ms-[46px] flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("home.worldMap.status.verifyingLocations")}
                        </p>
                      )}
                    </div>
                    <button className="p-2 rounded-full hover:bg-muted transition-colors" onClick={handleBackToWorld}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* University List */}
                <div className="flex-1 overflow-y-auto">
                  {loadingUnis ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : totalCount === 0 ? (
                    <div className="p-6 text-center">
                      <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">{t("home.worldMap.status.noUniversitiesInCity")}</p>
                    </div>
                  ) : displayedUnis.map((uni, idx) => (
                    <button
                      key={uni.university_id}
                      className={cn(
                        "w-full flex items-center gap-3.5 p-4 hover:bg-accent/10 transition-all text-start group",
                        idx !== 0 && "border-t border-border/50"
                      )}
                      onClick={() => navigate(`/university/${uni.university_id}`)}
                    >
                      {uni.university_logo ? (
                        <img src={uni.university_logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-background border border-border shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-sm">
                          <Building2 className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {getLocalizedValue(uni as unknown as Record<string, unknown>, "university_name")}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                            {uni.programs_count} {t("home.worldMap.labels.programs")}
                          </span>
                          {uni.fee_min != null && (
                            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                              <DollarSign className="h-3 w-3 shrink-0" />
                              ${uni.fee_min.toLocaleString()}{uni.fee_max != null ? ` – $${uni.fee_max.toLocaleString()}` : ''}
                            </span>
                          )}
                          {osmOverlay && osmOverlay.size > 0 && (() => {
                            const match = osmOverlay.get(uni.university_id);
                            if (match?.match_status === 'matched') {
                              return <span className="text-[10px] text-emerald-600/70 flex items-center gap-0.5">📍</span>;
                            }
                            return <span className="text-[10px] text-muted-foreground/40" title={t("home.worldMap.status.locationUnavailable")}>⚠️</span>;
                          })()}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 rtl:rotate-180" />
                    </button>
                  ))}
                  {hasMore && (
                    <div className="p-4">
                      <button
                        className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                        onClick={() => setShowAllUnis(true)}
                      >
                        {t("home.worldMap.actions.showAllUniversities", { count: totalCount })}
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── COUNTRY LEVEL: Cities list ── */}
          {drillLevel === "country" && selectedCountryInfo && (
            <>
              {/* Country Header */}
              <div className="p-5 border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    {selectedMeta?.image_url && (
                      <img src={selectedMeta.image_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-md border border-border" />
                    )}
                    <div>
                      <h3 className="font-bold text-xl text-foreground">
                        {getLocalizedValue(selectedCountryInfo as unknown as Record<string, unknown>, "country_name")}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          {selectedCountryInfo.universities_count.toLocaleString()} {t("home.worldMap.labels.universities")}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5 text-primary" />
                          {selectedCountryInfo.programs_count.toLocaleString()} {t("home.worldMap.labels.programs")}
                        </span>
                      </div>
                      {selectedCountryInfo.fee_min != null && selectedCountryInfo.fee_max != null && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          💰 ${selectedCountryInfo.fee_min.toLocaleString()} – ${selectedCountryInfo.fee_max.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button className="p-2 rounded-full hover:bg-muted transition-colors" onClick={handleBackToWorld}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                {selectedMeta?.slug && (
                  <button
                    className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
                    onClick={() => navigate(`/country/${selectedMeta.slug}`)}
                  >
                    <MapPin className="h-4 w-4" />
                    {t("home.worldMap.actions.viewCountryPage")}
                  </button>
                )}
              </div>

              {/* Cities List */}
              <div className="flex-1 overflow-y-auto">
                {countryLevelLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : visibleCities.length > 0 ? (
                  <>
                    <div className="px-5 py-3 border-b border-border/50">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary/60" />
                        {t("home.worldMap.stats.citiesCount", { count: visibleCities.length })}
                        {visibleCities.length < geoEnrichedCities.length && (
                          <span className="text-muted-foreground/50 font-normal normal-case">
                            / {geoEnrichedCities.length}
                          </span>
                        )}
                      </p>
                    </div>
                    {[...visibleCities]
                      .sort((a, b) => b.universities_count - a.universities_count)
                      .map((city, idx) => (
                        city.city === "__unknown__" ? (
                        <div
                          key="__unknown__"
                          className={cn(
                            "w-full flex items-center justify-between px-5 py-4 text-start opacity-60",
                            idx !== 0 && "border-t border-border/40"
                          )}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                              <MapPin className="h-4.5 w-4.5 text-muted-foreground/50" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-muted-foreground">
                                {t("home.worldMap.status.cityNotSpecified")}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground/70">
                                  {city.programs_count} {t("home.worldMap.labels.programs")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                            {city.universities_count}
                          </span>
                        </div>
                        ) :
                        <button
                          key={city.city}
                          className={cn(
                            "w-full flex items-center justify-between px-5 py-4 hover:bg-accent/10 transition-all text-start group",
                            idx !== 0 && "border-t border-border/40"
                          )}
                          onClick={() => handleCityClick(city.city)}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                              <MapPin className="h-4.5 w-4.5 text-primary" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{city.city}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  {city.programs_count} {t("home.worldMap.labels.programs")}
                                </span>
                                {city.fee_min != null && city.fee_max != null && (
                                  <>
                                    <span className="text-muted-foreground/30">·</span>
                                    <span className="text-xs text-muted-foreground/70">
                                      ${city.fee_min.toLocaleString()} – ${city.fee_max.toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-full shadow-sm">
                              {city.universities_count}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors rtl:rotate-180" />
                          </div>
                        </button>
                      ))}
                  </>
                ) : (
                  /* Fallback: no city data */
                  <div className="p-6 space-y-4">
                    <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 text-center space-y-3">
                      <Building2 className="h-10 w-10 mx-auto text-primary/30" />
                      <p className="text-sm font-semibold text-foreground">
                        {t("home.worldMap.status.cityDataCompleting")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("home.worldMap.status.browseViaSearchMeanwhile")}
                      </p>
                    </div>
                    <button
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (selectedMeta?.slug) params.set("country", selectedMeta.slug);
                        if (filters.degree_slug !== "all") params.set("degree", filters.degree_slug);
                        if (filters.fees_max < DEFAULT_FEES_MAX) params.set("fees_max", String(filters.fees_max));
                        navigate(`/search?${params.toString()}`);
                      }}
                    >
                      <Search className="h-4 w-4" />
                      {t("home.worldMap.actions.viewCountryResultsInSearch")}
                    </button>
                    {selectedCountryInfo && (
                      <p className="text-xs text-muted-foreground text-center">
                        {selectedCountryInfo.universities_count.toLocaleString()} {t("home.worldMap.stats.universitiesAvailable")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── WORLD LEVEL: Top countries ── */}
          {drillLevel === "world" && (
            <div className="flex flex-col h-full">
              {/* Hero area with gradient bg */}
              <div className="relative text-center space-y-3 py-10 px-6 bg-gradient-to-b from-primary/5 to-transparent">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-[0_0_25px_-5px_hsl(var(--primary)/0.3)]">
                  <Globe className="h-8 w-8 text-primary animate-[spin_25s_linear_infinite]" />
                </div>
                <h3 className="font-bold text-lg text-foreground">{t("home.worldMap.section.selectCountryTitle")}</h3>
                <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">{t("home.worldMap.section.selectCountrySubtitle")}</p>
              </div>
              <div className="flex-1 overflow-y-auto border-t border-border">
                {/* Country search input */}
                <div className="px-4 pt-3 pb-1">
                  <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder={t("home.worldMap.section.searchCountryPlaceholder")}
                      className="w-full ps-9 pe-8 py-2 text-sm rounded-lg bg-muted/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none placeholder:text-muted-foreground/60 text-foreground transition-colors"
                    />
                    {countrySearch && (
                      <button
                        onClick={() => setCountrySearch("")}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-5 py-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("home.worldMap.section.topCountries")}</p>
                </div>
                {(() => {
                  const searchLower = countrySearch.toLowerCase().trim();
                  return Object.entries(countryStats || {})
                  .filter(([code, v]) => {
                    if (v.universities_count === 0) return false;
                    if (filteredCodes && !filteredCodes.has(code)) return false;
                    if (searchLower) {
                      const nameAr = (v as any).country_name_ar || "";
                      const nameEn = (v as any).country_name_en || "";
                      const metaAr = countryMeta?.[code]?.name_ar || "";
                      const metaEn = countryMeta?.[code]?.name_en || "";
                      const allNames = `${nameAr} ${nameEn} ${metaAr} ${metaEn} ${code}`.toLowerCase();
                      if (!allNames.includes(searchLower)) return false;
                    }
                    return true;
                  })
                  .sort(([, a], [, b]) => b.universities_count - a.universities_count)
                  .slice(0, countrySearch ? 50 : 12)
                  .map(([code, info], idx) => {
                    const rankColors = ['bg-warning text-warning-foreground', 'bg-muted text-muted-foreground', 'bg-accent text-accent-foreground'];
                    return (
                      <button
                        key={code}
                        className={cn(
                          "w-full flex items-center justify-between px-5 py-3.5 transition-all text-start group",
                          "hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent",
                          idx !== 0 && "border-t border-border/40"
                        )}
                        onClick={() => handleCountryClick(code)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank badge for top 3 */}
                          <div className="w-6 shrink-0 text-center">
                            {idx < 3 ? (
                              <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black", rankColors[idx])}>
                                {idx + 1}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 font-medium">{idx + 1}</span>
                            )}
                          </div>
                          {countryMeta?.[code]?.image_url ? (
                            <img src={countryMeta[code].image_url!} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-border shadow-sm group-hover:border-primary/30 transition-colors" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border-2 border-border">
                              <Globe className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                              {getLocalizedValue(info as unknown as Record<string, unknown>, "country_name")}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {info.programs_count.toLocaleString()} {t("home.worldMap.labels.programs")}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-primary-foreground bg-gradient-to-r from-primary to-primary/80 px-3 py-1.5 rounded-full shadow-md group-hover:shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)] transition-shadow">
                          {info.universities_count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
