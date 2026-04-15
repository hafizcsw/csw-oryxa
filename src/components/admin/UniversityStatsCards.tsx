import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, CheckCircle2, AlertTriangle, XCircle, LucideIcon, Rocket, FileX, ShieldCheck, ShieldOff, MapPinOff, Download, Loader2, GlobeIcon, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UniversityStatsCardsProps {
  total: number;
  complete: number;
  incomplete: number;
  inactive: number;
  publishedPrograms?: number;
  draftPrograms?: number;
  inactiveReady?: number;
  inactiveQuarantine?: number;
  noCity?: number;
  noWebsite?: number;
}

interface CompactStatBadgeProps {
  label: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
  delay?: number;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  actionLoading?: boolean;
}

function CompactStatBadge({
  label,
  value,
  icon: Icon,
  gradient,
  delay = 0,
  actionIcon: ActionIcon,
  onAction,
  actionLoading = false,
}: CompactStatBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay }}
            className="flex items-center gap-1 px-1.5 py-1 rounded bg-muted/40 cursor-default hover:bg-muted/70 transition-colors"
          >
            <div className={cn("p-0.5 rounded shrink-0", gradient)}>
              <Icon className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-foreground tabular-nums leading-none">
              {value.toLocaleString()}
            </span>
            {ActionIcon && onAction && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction(); }}
                disabled={actionLoading}
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                {actionLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" /> : <ActionIcon className="w-2.5 h-2.5 text-muted-foreground hover:text-foreground" />}
              </button>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}: {value.toLocaleString()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function UniversityStatsCards({
  total,
  complete,
  incomplete,
  inactive,
  publishedPrograms = 0,
  draftPrograms = 0,
  inactiveReady = 0,
  inactiveQuarantine = 0,
  noCity = 0,
  noWebsite = 0,
}: UniversityStatsCardsProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [downloadingWebsite, setDownloadingWebsite] = useState(false);

  const handleDownloadNoCity = async () => {
    setDownloading(true);
    try {
      const allRows: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("universities")
          .select("name, country_code, countries(name_en)")
          .or("city.is.null,city.eq.,city.eq.NaN")
          .order("country_code", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true })
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const escape = (v: string | null) => {
        if (!v) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };

      const header = "الجامعة,الدولة,المدينة";
      const csvRows = allRows.map((r: any) =>
        [escape(r.name), escape((r.countries as any)?.name_en || ""), ""].join(",")
      );
      const csv = "\uFEFF" + [header, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `universities_no_city_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadNoWebsite = async () => {
    setDownloadingWebsite(true);
    try {
      const allRows: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("universities")
          .select("name, city, country_code, countries(name_en)")
          .or("website.is.null,website.eq.")
          .order("country_code", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true })
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const escape = (v: string | null) => {
        if (!v) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };

      const header = "الجامعة,الدولة,المدينة,الموقع الرسمي";
      const csvRows = allRows.map((r: any) =>
        [escape(r.name), escape((r.countries as any)?.name_en || ""), escape(r.city), ""].join(",")
      );
      const csv = "\uFEFF" + [header, ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `universities_no_website_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloadingWebsite(false);
    }
  };

  const allCards = [
    {
      label: t('admin.universities.stats.total'),
      value: total,
      icon: Building2,
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
      delay: 0,
    },
    {
      label: t('admin.universities.stats.complete'),
      value: complete,
      icon: CheckCircle2,
      gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
      delay: 0.05,
    },
    {
      label: t('admin.universities.stats.incomplete'),
      value: incomplete,
      icon: AlertTriangle,
      gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
      delay: 0.1,
    },
    {
      label: t('admin.universities.stats.inactive'),
      value: inactive,
      icon: XCircle,
      gradient: "bg-gradient-to-br from-red-500 to-rose-600",
      delay: 0.15,
    },
    {
      label: t('admin.universities.stats.published'),
      value: publishedPrograms,
      icon: Rocket,
      gradient: "bg-gradient-to-br from-violet-500 to-purple-600",
      delay: 0.2,
    },
    {
      label: t('admin.universities.stats.draft'),
      value: draftPrograms,
      icon: FileX,
      gradient: "bg-gradient-to-br from-slate-500 to-gray-600",
      delay: 0.25,
    },
    {
      label: t('admin.universities.stats.inactiveReady'),
      value: inactiveReady,
      icon: ShieldCheck,
      gradient: "bg-gradient-to-br from-cyan-500 to-teal-600",
      delay: 0.3,
    },
    {
      label: t('admin.universities.stats.inactiveQuarantine'),
      value: inactiveQuarantine,
      icon: ShieldOff,
      gradient: "bg-gradient-to-br from-rose-600 to-red-700",
      delay: 0.35,
    },
    {
      label: "بدون مدينة",
      value: noCity,
      icon: MapPinOff,
      gradient: "bg-gradient-to-br from-orange-500 to-red-500",
      delay: 0.4,
      actionIcon: Download,
      onAction: handleDownloadNoCity,
      actionLoading: downloading,
    },
    {
      label: "بدون موقع رسمي",
      value: noWebsite,
      icon: GlobeIcon,
      gradient: "bg-gradient-to-br from-pink-500 to-rose-600",
      delay: 0.45,
      actionIcon: ExternalLink,
      onAction: () => navigate("/admin/website-enrichment"),
      actionLoading: false,
    },
  ];

  return (
    <div className="flex flex-nowrap gap-1 mb-2 overflow-hidden">
      {allCards.map((card, index) => (
        <CompactStatBadge key={index} {...card} />
      ))}
    </div>
  );
}
