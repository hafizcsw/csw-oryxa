import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { DSButton } from "@/components/design-system/DSButton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, BookOpen, Globe, Search, X, Filter, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import UniversityMobileCard from "@/components/admin/UniversityMobileCard";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCountryName } from "@/hooks/useCountryName";
import { useDebounce } from "@/hooks/useDebounce";

import UniversityStatsCards from "@/components/admin/UniversityStatsCards";
import UniversityBulkActions from "@/components/admin/UniversityBulkActions";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 50;

type Uni = {
  id: string;
  name: string;
  country_id: string;
  country_name?: string;
  city?: string | null;
  logo_url?: string | null;
  website?: string | null;
  is_active?: boolean;
  cwur_world_rank?: number | null;
  cwur_national_rank?: number | null;
  cwur_education_rank?: number | null;
  cwur_employability_rank?: number | null;
  cwur_faculty_rank?: number | null;
  cwur_research_rank?: number | null;
  cwur_score?: number | null;
};

type Country = {
  id: string;
  name_ar: string;
  slug: string;
};

export default function UniversitiesAdmin() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { getCountryName } = useCountryName();

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  const [rows, setRows] = useState<Uni[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [countries, setCountries] = useState<Country[]>([]);
  const [q, setQ] = useState("");
  const debouncedSearch = useDebounce(q, 300);
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [completenessFilter, setCompletenessFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | active | inactive_ready | inactive_quarantine | no_city
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [programStats, setProgramStats] = useState({ published: 0, draft: 0 });

  // Stats from separate lightweight queries
  const [stats, setStats] = useState({ total: 0, complete: 0, incomplete: 0, inactive: 0, inactiveReady: 0, inactiveQuarantine: 0, noCity: 0, noWebsite: 0 });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const calculateCompleteness = (uni: Uni) => {
    const fields = [uni.city, uni.logo_url, uni.website, uni.cwur_world_rank, uni.cwur_national_rank, uni.cwur_score];
    const filled = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
    return Math.round(filled / fields.length * 100);
  };

  // Filter by completeness client-side (only on current page data)
  const filtered = useMemo(() => {
    if (completenessFilter === "all") return rows;
    return rows.filter((r) => {
      const c = calculateCompleteness(r);
      if (completenessFilter === "complete") return c >= 80;
      if (completenessFilter === "incomplete") return c < 80;
      if (completenessFilter === "critical") return c < 50;
      return true;
    });
  }, [rows, completenessFilter]);

  // Reset page when filters change
  useEffect(() => {setPage(1);}, [debouncedSearch, selectedCountry, statusFilter]);

  // Load data via RPC
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const countryId = selectedCountry === "all" ? null : selectedCountry;

      // Map statusFilter to RPC params
      let pIsActive: boolean | null = null;
      let pHasCountry: boolean | null = null;
      let pHasCity: boolean | null = null;
      if (statusFilter === "active") {
        pIsActive = true;
      } else if (statusFilter === "inactive_ready") {
        pIsActive = false;
        pHasCountry = true;
      } else if (statusFilter === "inactive_quarantine") {
        pIsActive = false;
        pHasCountry = false;
      } else if (statusFilter === "no_city") {
        pHasCity = false;
      }

      const { data, error } = await supabase.rpc("admin_list_universities" as any, {
        p_search: debouncedSearch,
        p_country_id: countryId,
        p_is_active: pIsActive,
        p_has_country: pHasCountry,
        p_has_city: pHasCity,
        p_page: page,
        p_page_size: PAGE_SIZE
      });

      if (error) {
        toastRef.current({ variant: "destructive", title: tRef.current('admin.toast.error'), description: error.message });
        return;
      }

      const result = data as any;
      const unis: Uni[] = (result?.data || []).map((u: any) => ({
        ...u,
        country_name: u.country_name
      }));

      setRows(unis);
      setTotalCount(result?.total || 0);
    } catch (err: any) {
      toastRef.current({ variant: "destructive", title: tRef.current('admin.toast.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCountry, statusFilter, page]);

  // Load countries + stats (once)
  const loadMeta = useCallback(async () => {
    const [countriesRes, publishedRes, draftRes, totalRes, inactiveRes, inactiveReadyRes, inactiveQuarantineRes, noCityRes, noWebsiteRes] = await Promise.all([
    supabase.from("countries").select("id,name_ar,slug").order("name_ar"),
    supabase.from("programs").select("id", { count: 'exact', head: true }).eq("publish_status", "published"),
    supabase.from("programs").select("id", { count: 'exact', head: true }).neq("publish_status", "published"),
    supabase.from("universities").select("id", { count: 'exact', head: true }),
    supabase.from("universities").select("id", { count: 'exact', head: true }).eq("is_active", false),
    supabase.from("universities").select("id", { count: 'exact', head: true }).eq("is_active", false).not("country_id", "is", null),
    supabase.from("universities").select("id", { count: 'exact', head: true }).eq("is_active", false).is("country_id", null),
    supabase.from("universities").select("id", { count: 'exact', head: true }).or("city.is.null,city.eq.,city.eq.NaN"),
    supabase.from("universities").select("id", { count: 'exact', head: true }).eq("is_active", true).or("website.is.null,website.eq.")]
    );

    setCountries(countriesRes.data || []);
    setProgramStats({ published: publishedRes.count || 0, draft: draftRes.count || 0 });
    setStats({
      total: totalRes.count || 0,
      complete: 0,
      incomplete: 0,
      inactive: inactiveRes.count || 0,
      inactiveReady: inactiveReadyRes.count || 0,
      inactiveQuarantine: inactiveQuarantineRes.count || 0,
      noCity: noCityRes.count || 0,
      noWebsite: noWebsiteRes.count || 0
    });
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadMeta();
    }
  }, [authLoading, isAdmin, loadMeta]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      load();
    }
  }, [authLoading, isAdmin, load]);

  const remove = async (id: string) => {
    if (!confirm(t('admin.universities.confirmDelete'))) return;
    const { error } = await supabase.from("universities").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: t('admin.toast.error'), description: error.message });
      return;
    }
    toast({ title: t('admin.toast.deleted') });
    load();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((r) => r.id));
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>);

  }

  return (
    <div className="container mx-auto py-3 px-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('admin.universities.title')}</h1>
          
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/university/new/studio">
            <DSButton variant="primary">
              <Plus className="w-4 h-4 ml-2" />
              {t('admin.universities.addUniversity')}
            </DSButton>
          </Link>
          <DSButton variant="outline" onClick={load} disabled={loading}>
            {t('admin.universities.refresh')}
          </DSButton>
        </div>
      </div>

      <UniversityStatsCards
        total={stats.total}
        complete={stats.complete}
        incomplete={stats.incomplete}
        inactive={stats.inactive}
        publishedPrograms={programStats.published}
        draftPrograms={programStats.draft}
        inactiveReady={stats.inactiveReady}
        inactiveQuarantine={stats.inactiveQuarantine}
        noCity={stats.noCity}
        noWebsite={stats.noWebsite} />


      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-2xl bg-card/50 backdrop-blur-xl border shadow-lg">

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.universities.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-10 bg-background/50" />

            {q &&
            <button
              onClick={() => setQ("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">

                <X className="w-4 h-4" />
              </button>
            }
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-[200px] bg-background/50">
                <Globe className="w-4 h-4 ml-2 text-primary" />
                <SelectValue placeholder={t('admin.universities.allCountries')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-medium">
                  {t('admin.universities.allCountries')}
                </SelectItem>
                {countries.map((country) =>
                <SelectItem key={country.id} value={country.id}>
                    {getCountryName(country.slug, country.name_ar)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <Select value={completenessFilter} onValueChange={setCompletenessFilter}>
              <SelectTrigger className="w-[180px] bg-background/50">
                <Filter className="w-4 h-4 ml-2 text-primary" />
                <SelectValue placeholder={t('admin.universities.filterCompleteness')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.universities.allUniversities')}</SelectItem>
                <SelectItem value="complete">{t('admin.universities.complete')}</SelectItem>
                <SelectItem value="incomplete">{t('admin.universities.incomplete')}</SelectItem>
                <SelectItem value="critical">{t('admin.universities.critical')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] bg-background/50">
                <ShieldAlert className="w-4 h-4 ml-2 text-primary" />
                <SelectValue placeholder={t('admin.universities.status.filterLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.universities.allUniversities')}</SelectItem>
                <SelectItem value="active">{t('admin.universities.status.activeOnly')}</SelectItem>
                <SelectItem value="no_city">
                  <span className="flex items-center gap-1">
                    بدون مدينة
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">{stats.noCity.toLocaleString()}</Badge>
                  </span>
                </SelectItem>
                <SelectItem value="inactive_ready">{t('admin.universities.status.inactiveReady')}</SelectItem>
                <SelectItem value="inactive_quarantine">{t('admin.universities.status.inactiveQuarantine')}</SelectItem>
              </SelectContent>
            </Select>

            <UniversityBulkActions
              selectedIds={selectedIds}
              isQuarantineFilter={statusFilter === "inactive_quarantine"}
              onActionComplete={() => {
                setSelectedIds([]);
                load();
                loadMeta();
              }} />

          </div>
        </div>

        {/* Active Filters Chips */}
        <AnimatePresence>
          {(selectedCountry !== "all" || completenessFilter !== "all" || statusFilter !== "all" || q) &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">

              <span className="text-xs text-muted-foreground">{t('admin.universities.activeFilters')}</span>
              
              {q &&
            <Badge variant="secondary" className="gap-1 pr-1">
                  {t('admin.universities.search')} {q}
                  <button onClick={() => setQ("")} className="hover:bg-muted rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
            }
              
              {selectedCountry !== "all" &&
            <Badge variant="secondary" className="gap-1 pr-1">
                  {(() => {const c = countries.find((c) => c.id === selectedCountry);return c ? getCountryName(c.slug, c.name_ar) : '';})()}
                  <button onClick={() => setSelectedCountry("all")} className="hover:bg-muted rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
            }
              
              {completenessFilter !== "all" &&
            <Badge variant="secondary" className="gap-1 pr-1">
                  {completenessFilter === "complete" ? t('admin.universities.complete') : completenessFilter === "incomplete" ? t('admin.universities.incomplete') : t('admin.universities.critical')}
                  <button onClick={() => setCompletenessFilter("all")} className="hover:bg-muted rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
            }
              
              {statusFilter !== "all" &&
            <Badge variant="secondary" className="gap-1 pr-1">
                  {statusFilter === "active" ? t('admin.universities.status.activeOnly') : statusFilter === "no_city" ? `بدون مدينة (${stats.noCity.toLocaleString()})` : statusFilter === "inactive_ready" ? t('admin.universities.status.inactiveReady') : t('admin.universities.status.inactiveQuarantine')}
                  <button onClick={() => setStatusFilter("all")} className="hover:bg-muted rounded p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
            }
              
              <button
              onClick={() => {
                setQ("");
                setSelectedCountry("all");
                setCompletenessFilter("all");
                setStatusFilter("all");
              }}
              className="text-xs text-primary hover:underline mr-auto">

                {t('admin.universities.clearAll')}
              </button>
            </motion.div>
          }
        </AnimatePresence>
      </motion.div>

      {loading ?
      <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div> :

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card rounded-2xl border shadow-lg overflow-hidden">

          
          {/* Mobile View */}
          <div className="block lg:hidden p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border">
              <Checkbox
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onCheckedChange={toggleSelectAll} />

              <span className="text-sm font-medium">
                {t('admin.universities.selectAll')} ({filtered.length})
              </span>
            </div>
            
            {filtered.map((r, index) =>
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}>

                <UniversityMobileCard
              university={r}
              isSelected={selectedIds.includes(r.id)}
              onToggleSelect={() => toggleSelection(r.id)}
              onRemove={() => remove(r.id)} />

              </motion.div>
          )}
            
            {filtered.length === 0 &&
          <div className="text-center p-12 text-muted-foreground">
                {t('admin.universities.noResults')}
              </div>
          }
          </div>
          
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-y-auto overflow-x-hidden max-h-[calc(100vh-320px)] bg-card rounded-lg border">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-muted/80 to-muted/40 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <Checkbox
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleSelectAll} />

                  </th>
                  <th className="text-right px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.institution')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.location')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.worldRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.nationalRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.educationRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.employmentRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.academicRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.researchRank')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.score')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground">{t('admin.universities.columns.status')}</th>
                  <th className="px-2 py-2 font-semibold text-xs text-muted-foreground text-left">{t('admin.universities.columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((r, index) => {
                const completeness = calculateCompleteness(r);
                const rowBorder =
                completeness >= 80 ? "border-r-emerald-500" :
                completeness >= 50 ? "border-r-amber-500" :
                "border-r-red-500";

                return (
                  <motion.tr
                    key={r.id}
                    id={`uni-row-${r.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "group hover:bg-muted/50 transition-all duration-200",
                      "border-r-4",
                      rowBorder,
                      selectedIds.includes(r.id) && "bg-primary/5"
                    )}>

                      <td className="p-2 text-center">
                        <Checkbox
                        checked={selectedIds.includes(r.id)}
                        onCheckedChange={() => toggleSelection(r.id)} />

                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          {r.logo_url &&
                        <img src={r.logo_url} alt="" className="h-6 w-6 rounded-md object-contain bg-muted/50 p-0.5 flex-shrink-0" />
                        }
                          <span className="text-xs font-semibold text-foreground max-w-[180px] truncate" title={r.name}>{r.name}</span>
                        </div>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground max-w-[120px] truncate" title={`${r.country_name}${r.city ? ` - ${r.city}` : ""}`}>
                        {r.country_name}{r.city ? ` - ${r.city}` : ""}
                      </td>
                      <td className="p-2">
                        {r.cwur_world_rank ?
                      <Badge variant="outline" className="font-bold text-primary border-primary/30 text-xs px-1.5 py-0.5">
                            #{r.cwur_world_rank}
                          </Badge> :
                      <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.cwur_national_rank ?
                      <span className="font-medium">#{r.cwur_national_rank}</span> :
                      <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.cwur_education_rank ?
                      <span className="font-medium text-blue-600 dark:text-blue-400">#{r.cwur_education_rank}</span> :
                      <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.cwur_employability_rank ?
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">#{r.cwur_employability_rank}</span> :
                      <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.cwur_faculty_rank ?
                      <span className="font-medium text-amber-600 dark:text-amber-400">#{r.cwur_faculty_rank}</span> :
                      <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-2 text-xs">
                        {r.cwur_research_rank ?
                      <span className="font-medium text-purple-600 dark:text-purple-400">#{r.cwur_research_rank}</span> :
                      <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="p-2">
                        {r.cwur_score ?
                      <Badge className="bg-gradient-to-r from-primary to-primary/80 font-bold text-xs px-1.5 py-0.5">
                            {r.cwur_score.toFixed(1)}
                          </Badge> :
                      <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                      <td className="p-2">
                        <Badge
                        variant={r.is_active ? "default" : "secondary"}
                        className={cn(
                          "text-xs px-1.5 py-0.5",
                          r.is_active && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}>

                          {r.is_active ? t('admin.universities.status.active') : t('admin.universities.status.inactive')}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1.5 justify-end opacity-70 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link to={`/admin/university/${r.id}/studio?tab=programs`}>
                                <DSButton variant="outline" size="xs">
                                  <BookOpen className="w-3 h-3" />
                                </DSButton>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.universities.tooltips.managePrograms')}</TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link to={`/admin/university/${r.id}/studio`}>
                                <DSButton variant="primary" size="xs">
                                  <Pencil className="w-3 h-3" />
                                </DSButton>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.universities.tooltips.studio')}</TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DSButton
                              variant="outline"
                              size="xs"
                              onClick={() => remove(r.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10">

                                <Trash2 className="w-3 h-3" />
                              </DSButton>
                            </TooltipTrigger>
                            <TooltipContent>{t('admin.universities.tooltips.delete')}</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </motion.tr>);

              })}
                {filtered.length === 0 &&
              <tr>
                    <td colSpan={12} className="text-center p-12 text-muted-foreground">
                      {t('admin.universities.noResults')}
                    </td>
                  </tr>
              }
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 &&
        <div className="flex items-center justify-center gap-4 p-4 border-t">
              <DSButton
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}>

                <ChevronRight className="w-4 h-4 ml-1" />
                {t('admin.universities.pagination.previous')}
              </DSButton>
              
              <div className="text-sm text-muted-foreground">
                {t('admin.universities.pagination.page')} <strong>{page}</strong> {t('admin.universities.pagination.of')} <strong>{totalPages}</strong>
                <span className="mx-2">•</span>
                <span>{totalCount.toLocaleString()} {t('admin.universities.pagination.university')}</span>
              </div>
              
              <DSButton
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}>

                {t('admin.universities.pagination.next')}
                <ChevronLeft className="w-4 h-4 mr-1" />
              </DSButton>
            </div>
        }
        </motion.div>
      }
    </div>);

}