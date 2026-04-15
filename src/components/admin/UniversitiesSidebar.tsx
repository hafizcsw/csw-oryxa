import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountryName } from "@/hooks/useCountryName";

interface UniversitiesSidebarProps {
  selectedUniversityId?: string;
  onSelect: (universityId: string) => void;
}

export default function UniversitiesSidebar({ 
  selectedUniversityId, 
  onSelect 
}: UniversitiesSidebarProps) {
  const { t } = useTranslation("common");
  const { getCountryName } = useCountryName();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const { data: universities = [], isLoading } = useQuery({
    queryKey: ["universities-list", search, countryFilter],
    queryFn: async () => {
      let query = supabase
        .from("universities")
        .select("id, name, city, country_id, logo_url");

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      if (countryFilter !== "all") {
        query = query.eq("country_id", countryFilter);
      }

      const { data, error } = await query
        .order("cwur_world_rank", { ascending: true, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("id, slug, name_ar")
        .order("name_ar");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="w-80 border-l flex flex-col h-full bg-card">
      <div className="p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {t("admin.sidebar.universities")}
        </h2>
        
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.universities.searchByName")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t("admin.universities.filterByCountry")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.universities.allCountries")}</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country.id} value={String(country.id)}>
                {getCountryName(country.slug, country.name_ar)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-4">{t("loading")}</p>
          ) : universities.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">{t("admin.universities.noResults")}</p>
          ) : (
            universities.map((uni) => (
              <Button
                key={uni.id}
                variant={selectedUniversityId === uni.id ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => onSelect(uni.id)}
              >
                {uni.logo_url ? (
                  <img
                    src={uni.logo_url}
                    alt={uni.name}
                    className="w-8 h-8 object-contain rounded"
                  />
                ) : (
                  <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 text-right overflow-hidden">
                  <p className="font-medium text-sm truncate">{uni.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{uni.city}</p>
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Badge variant="outline" className="w-full justify-center">
          {universities.length} {t("admin.universities.pagination.university")}
        </Badge>
      </div>
    </div>
  );
}
