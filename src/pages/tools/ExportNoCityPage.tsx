import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2, MapPin, Globe, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";

function useExporter() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  return { loading, setLoading, progress, setProgress };
}

const escape = (v: string | null) => {
  if (!v) return "";
  const s = String(v).replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
};

async function fetchBatched(
  query: (from: number, to: number) => any,
  onProgress: (count: number) => void,
  batchSize = 1000
) {
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await query(from, from + batchSize - 1);
    if (error) throw error;
    const batch = data || [];
    allRows.push(...batch);
    onProgress(allRows.length);
    if (batch.length < batchSize) break;
    from += batchSize;
  }
  return allRows;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ExportNoCityPage() {
  const noCity = useExporter();
  const noWebsite = useExporter();
  const qsRanking = useExporter();

  const handleExportNoCity = async () => {
    noCity.setLoading(true);
    noCity.setProgress("جاري جلب البيانات...");
    try {
      const rows = await fetchBatched(
        (from, to) =>
          supabase
            .from("universities")
            .select("name, countries(name_en)")
            .or("city.is.null,city.eq.")
            .eq("is_active", true)
            .order("country_code", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true })
            .range(from, to),
        (count) => noCity.setProgress(`جاري الجلب... ${count} سجل`)
      );
      const header = "#,الجامعة,الدولة,المدينة";
      const csvRows = rows.map((r: any, i: number) =>
        [i + 1, escape(r.name), escape(r.countries?.name_en || ""), ""].join(",")
      );
      downloadCsv("\uFEFF" + [header, ...csvRows].join("\n"), `universities_no_city_${new Date().toISOString().slice(0, 10)}.csv`);
      noCity.setProgress(`تم تحميل CSV — ${rows.length} جامعة ✓`);
    } catch (err: any) {
      noCity.setProgress("خطأ: " + (err.message || "حاول مرة أخرى"));
    } finally {
      noCity.setLoading(false);
    }
  };

  const handleExportNoWebsite = async () => {
    noWebsite.setLoading(true);
    noWebsite.setProgress("جاري جلب البيانات...");
    try {
      const rows = await fetchBatched(
        (from, to) =>
          supabase
            .from("universities")
            .select("name, city, countries(name_en)")
            .or("website.is.null,website.eq.")
            .eq("is_active", true)
            .order("country_code", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true })
            .range(from, to),
        (count) => noWebsite.setProgress(`جاري الجلب... ${count} سجل`)
      );
      const header = "#,الجامعة,الدولة,المدينة,الموقع الرسمي";
      const csvRows = rows.map((r: any, i: number) =>
        [i + 1, escape(r.name), escape(r.countries?.name_en || ""), escape(r.city), ""].join(",")
      );
      downloadCsv("\uFEFF" + [header, ...csvRows].join("\n"), `universities_no_website_${new Date().toISOString().slice(0, 10)}.csv`);
      noWebsite.setProgress(`تم تحميل CSV — ${rows.length} جامعة ✓`);
    } catch (err: any) {
      noWebsite.setProgress("خطأ: " + (err.message || "حاول مرة أخرى"));
    } finally {
      noWebsite.setLoading(false);
    }
  };

  const handleExportQsRanking = async () => {
    qsRanking.setLoading(true);
    qsRanking.setProgress("جاري جلب البيانات...");
    try {
      const rows = await fetchBatched(
        (from, to) =>
          supabase
            .from("universities")
            .select("name, ranking, city, website, countries(name_en), country_id, is_active")
            .not("ranking", "is", null)
            .order("ranking", { ascending: true })
            .range(from, to),
        (count) => qsRanking.setProgress(`جاري الجلب... ${count} سجل`)
      );
      const header = "#,QS_Rank,الجامعة,الدولة,المدينة,الموقع الرسمي,لديها_دولة,نشطة";
      const csvRows = rows.map((r: any, i: number) =>
        [
          i + 1,
          r.ranking,
          escape(r.name),
          escape(r.countries?.name_en || ""),
          escape(r.city),
          escape(r.website),
          r.country_id ? "✓" : "✗",
          r.is_active ? "✓" : "✗",
        ].join(",")
      );
      downloadCsv("\uFEFF" + [header, ...csvRows].join("\n"), `universities_qs_ranking_${new Date().toISOString().slice(0, 10)}.csv`);
      qsRanking.setProgress(`تم تحميل CSV — ${rows.length} جامعة ✓`);
    } catch (err: any) {
      qsRanking.setProgress("خطأ: " + (err.message || "حاول مرة أخرى"));
    } finally {
      qsRanking.setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8" dir="rtl">
      <div className="grid gap-6 md:grid-cols-3 max-w-4xl w-full">
        {/* ترتيب QS */}
        <Card className="p-6 text-center space-y-4 border-primary/30">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">جامعات QS Ranking</h2>
          <p className="text-muted-foreground text-xs">
            جميع الجامعات التي تحمل ترتيب QS مع حالة البيانات
          </p>
          <Button onClick={handleExportQsRanking} disabled={qsRanking.loading} size="lg" className="gap-2 w-full">
            {qsRanking.loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
            {qsRanking.loading ? "جاري التصدير..." : "تحميل CSV"}
          </Button>
          {qsRanking.progress && <p className="text-xs text-muted-foreground">{qsRanking.progress}</p>}
        </Card>

        {/* بدون مدينة */}
        <Card className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">جامعات بدون مدينة</h2>
          <p className="text-muted-foreground text-xs">
            الأعمدة: # | الجامعة | الدولة | المدينة (فارغة)
          </p>
          <Button onClick={handleExportNoCity} disabled={noCity.loading} size="lg" variant="secondary" className="gap-2 w-full">
            {noCity.loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
            {noCity.loading ? "جاري التصدير..." : "تحميل CSV"}
          </Button>
          {noCity.progress && <p className="text-xs text-muted-foreground">{noCity.progress}</p>}
        </Card>

        {/* بدون موقع إلكتروني */}
        <Card className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-accent" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground">جامعات بدون موقع رسمي</h2>
          <p className="text-muted-foreground text-xs">
            الأعمدة: # | الجامعة | الدولة | المدينة | الموقع الرسمي (فارغ)
          </p>
          <Button onClick={handleExportNoWebsite} disabled={noWebsite.loading} size="lg" variant="secondary" className="gap-2 w-full">
            {noWebsite.loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Download className="h-5 w-5" />}
            {noWebsite.loading ? "جاري التصدير..." : "تحميل CSV"}
          </Button>
          {noWebsite.progress && <p className="text-xs text-muted-foreground">{noWebsite.progress}</p>}
        </Card>
      </div>
    </div>
  );
}
