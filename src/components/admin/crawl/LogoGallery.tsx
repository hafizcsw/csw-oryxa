import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Search, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

const PAGE_SIZE = 50;
type FilterMode = "with_logo" | "without_logo" | "all";

export function LogoGallery() {
  const { t } = useTranslation("common");
  const [unis, setUnis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("with_logo");
  const [stats, setStats] = useState({ total: 0, withLogo: 0, withoutLogo: 0 });
  const [totalCount, setTotalCount] = useState(0);

  const fetchStats = useCallback(async () => {
    const [{ count: total }, { count: withLogo }] = await Promise.all([
      supabase.from("universities").select("id", { head: true, count: "exact" }).eq("is_active", true),
      supabase.from("universities").select("id", { head: true, count: "exact" }).eq("is_active", true).not("logo_url", "is", null),
    ]);
    setStats({ total: total || 0, withLogo: withLogo || 0, withoutLogo: (total || 0) - (withLogo || 0) });
  }, []);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("universities")
      .select("id, name, name_en, logo_url, country_code, logo_source, updated_at", { count: "exact" })
      .eq("is_active", true);

    if (filter === "with_logo") q = q.not("logo_url", "is", null);
    else if (filter === "without_logo") q = q.is("logo_url", null);

    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,name_en.ilike.%${search.trim()}%`);
    }

    q = q.order("updated_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setUnis(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchPage(); }, [fetchPage]);
  useEffect(() => { setPage(0); }, [filter, search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t("admin.singleTest.logoTitle")}
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-primary font-medium">{t("admin.singleTest.logoCount", { count: stats.withLogo })}</span>
            <span className="text-muted-foreground">{t("admin.singleTest.logoOf", { count: stats.total })}</span>
            <span className="text-destructive">{t("admin.singleTest.logoMissing", { count: stats.withoutLogo })}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin.singleTest.logoSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="with_logo">{t("admin.singleTest.withLogo")}</SelectItem>
              <SelectItem value="without_logo">{t("admin.singleTest.withoutLogo")}</SelectItem>
              <SelectItem value="all">{t("admin.singleTest.allFilter")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t("admin.singleTest.loading")}</div>
        ) : unis.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t("admin.singleTest.noResults")}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {unis.map((u) => (
              <div key={u.id} className="border rounded-lg p-3 flex flex-col items-center gap-2 hover:shadow-sm transition-shadow">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {u.logo_url ? (
                    <img src={u.logo_url} alt={u.name_en || u.name} className="w-full h-full object-contain" loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <p className="text-xs text-center font-medium truncate w-full" title={u.name || u.name_en}>
                  {u.name || u.name_en}
                </p>
                {u.logo_source && <span className="text-[10px] text-muted-foreground">{u.logo_source}</span>}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronRight className="h-4 w-4" />
              {t("admin.singleTest.prev")}
            </Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              {t("admin.singleTest.next")}
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
