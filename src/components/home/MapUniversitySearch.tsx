import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface UniversityResult {
  id: string;
  name: string;
  name_ar: string | null;
  city: string | null;
  country_code: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  logo_url: string | null;
  programs_count: number;
}

interface MapUniversitySearchProps {
  isRtl: boolean;
  onSelect: (uni: UniversityResult) => void;
}

export function MapUniversitySearch({ isRtl, onSelect }: MapUniversitySearchProps) {
  const { t, language } = useLanguage();
  const getLocalizedUniversityName = useCallback((uni: UniversityResult) => {
    const dynamicLanguageField = `name_${language}` as keyof UniversityResult;
    const localizedName = uni[dynamicLanguageField];
    if (typeof localizedName === "string" && localizedName.trim()) return localizedName;
    if (typeof uni.name === "string" && uni.name.trim()) return uni.name;
    if (typeof uni.name_ar === "string" && uni.name_ar.trim()) return uni.name_ar;
    return "";
  }, [language]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniversityResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchUniversities = useCallback(async (q: string) => {
    const normalizedQuery = q.trim();

    if (normalizedQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // Query from map SoT view using both Arabic + English university names
      const baseSelect = "university_id, university_name_en, university_name_ar, city, country_code, university_logo";
      const [enResult, arResult] = await Promise.all([
        supabase
          .from("vw_program_search_api_v3_final")
          .select(baseSelect)
          .ilike("university_name_en", `%${normalizedQuery}%`)
          .limit(100),
        supabase
          .from("vw_program_search_api_v3_final")
          .select(baseSelect)
          .ilike("university_name_ar", `%${normalizedQuery}%`)
          .limit(100),
      ]);

      if (enResult.error) throw enResult.error;
      if (arResult.error) throw arResult.error;

      const rows = [...(enResult.data || []), ...(arResult.data || [])];

      // Dedupe by university_id and count matched programs
      const uniMap = new Map<string, UniversityResult>();
      rows.forEach((row) => {
        const uid = row.university_id;
        if (!uid) return;

        const existing = uniMap.get(uid);
        if (existing) {
          existing.programs_count += 1;
          return;
        }

        uniMap.set(uid, {
          id: uid,
          name: row.university_name_en || row.university_name_ar || "",
          name_ar: row.university_name_ar || null,
          city: row.city || null,
          country_code: row.country_code || null,
          geo_lat: null,
          geo_lon: null,
          logo_url: row.university_logo || null,
          programs_count: 1,
        });
      });

      // Fetch map coordinates for matched universities
      const matchedIds = Array.from(uniMap.keys());
      if (matchedIds.length > 0) {
        const { data: coordsRows } = await supabase
          .from("universities")
          .select("id, geo_lat, geo_lon")
          .in("id", matchedIds);

        (coordsRows || []).forEach((coord) => {
          const existing = uniMap.get(coord.id);
          if (!existing) return;
          existing.geo_lat = coord.geo_lat ?? null;
          existing.geo_lon = coord.geo_lon ?? null;
        });
      }

      // Sort by programs_count desc, take top 8
      const sorted = Array.from(uniMap.values())
        .sort((a, b) => b.programs_count - a.programs_count)
        .slice(0, 8);

      setResults(sorted);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchUniversities(query);
      setIsOpen(true);
      setSelectedIndex(-1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchUniversities]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (uni: UniversityResult) => {
    setQuery(getLocalizedUniversityName(uni));
    setIsOpen(false);
    onSelect(uni);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[180px] max-w-[280px] z-[9999]">
      <div className="relative flex items-center h-10 bg-background border border-border rounded-lg overflow-hidden">
        <Search className="h-4 w-4 text-muted-foreground shrink-0 ms-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={t("home.worldMap.search.placeholder")}
          className="flex-1 h-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground px-2"
          dir={isRtl ? "rtl" : "ltr"}
        />
        {loading && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin me-2 shrink-0" />}
        {query && !loading && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="me-2 p-0.5 rounded hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 inset-x-0 z-[2000] bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-[300px] overflow-y-auto">
          {results.map((uni, idx) => (
            <button
              key={uni.id}
              onClick={() => handleSelect(uni)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-start transition-colors",
                idx !== 0 && "border-t border-border/50",
                selectedIndex === idx ? "bg-primary/10" : "hover:bg-accent/10"
              )}
            >
              {uni.logo_url ? (
                <img src={uni.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-background border border-border shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs">🏛️</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {getLocalizedUniversityName(uni)}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  {uni.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {uni.city}{uni.country_code ? ` · ${uni.country_code}` : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1">📚 {uni.programs_count} {t("home.worldMap.labels.programs")}</span>
                </div>
              </div>
              {uni.geo_lat == null && (
                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                  {t("home.worldMap.search.noCoords")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full mt-1 inset-x-0 z-[2000] bg-card border border-border rounded-xl shadow-xl p-4 text-center text-sm text-muted-foreground">
          {t("home.worldMap.search.noResults")}
        </div>
      )}
    </div>
  );
}
