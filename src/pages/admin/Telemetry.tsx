import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type KPI = { results_24h: number; apply_7d: number };
type Lat = { tab: string; p50_ms: number; p95_ms: number; n: number };
type Ev = { event: string; n: number };
type Pt = { day: string; tab: string; events: number };
type Conv = { country: string; results_hits: number; filter_hits: number };

export default function Telemetry() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPI>({ results_24h: 0, apply_7d: 0 });
  const [lat, setLat] = useState<Lat[]>([]);
  const [ev, setEv] = useState<Ev[]>([]);
  const [series, setSeries] = useState<Pt[]>([]);
  const [conv, setConv] = useState<Conv[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-telemetry-dashboard');
        if (error) throw error;
        if (!data.ok) throw new Error(data.error || 'fetch failed');
        
        setKpi(data.kpi);
        setLat(data.latency);
        setEv(data.events);
        setSeries(data.series);
        setConv(data.conv);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const p of series) {
      const d = p.day.slice(0, 10);
      const row = map.get(d) || {};
      row[p.tab] = (row[p.tab] || 0) + p.events;
      map.set(d, row);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [series]);

  const allTabs = useMemo(() => {
    return Array.from(new Set(series.map(s => s.tab))).sort();
  }, [series]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold">لوحة Telemetry</h2>

        {loading && (
          <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
        )}
        
        {err && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            خطأ: {err}
          </div>
        )}

        {!loading && !err && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border rounded-lg p-6">
                <div className="text-sm text-muted-foreground mb-2">
                  نتائج البحث (آخر 24 ساعة)
                </div>
                <div className="text-4xl font-bold">{kpi.results_24h.toLocaleString()}</div>
              </div>
              <div className="bg-card border rounded-lg p-6">
                <div className="text-sm text-muted-foreground mb-2">
                  طلبات التقديم (آخر 7 أيام)
                </div>
                <div className="text-4xl font-bold">{kpi.apply_7d.toLocaleString()}</div>
              </div>
            </div>

            {/* Latency Table */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">زمن الاستجابة - p50 / p95 (7 أيام)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 px-4">التبويب</th>
                      <th className="text-right py-2 px-4">p50 (ms)</th>
                      <th className="text-right py-2 px-4">p95 (ms)</th>
                      <th className="text-right py-2 px-4">العينات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lat.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{r.tab}</td>
                        <td className="py-2 px-4">{r.p50_ms}</td>
                        <td className="py-2 px-4">{r.p95_ms}</td>
                        <td className="py-2 px-4">{r.n.toLocaleString()}</td>
                      </tr>
                    ))}
                    {lat.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted-foreground">
                          لا توجد بيانات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Events Count */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">الأحداث (7 أيام)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 px-4">الحدث</th>
                      <th className="text-right py-2 px-4">العدد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ev.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4 font-mono text-sm">{r.event}</td>
                        <td className="py-2 px-4">{r.n.toLocaleString()}</td>
                      </tr>
                    ))}
                    {ev.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center py-4 text-muted-foreground">
                          لا توجد بيانات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversion by Country */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">
                معدل التحويل (Filter → Results) حسب الدولة (7 أيام)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 px-4">الدولة</th>
                      <th className="text-right py-2 px-4">Filter Hits</th>
                      <th className="text-right py-2 px-4">Results Hits</th>
                      <th className="text-right py-2 px-4">معدل التحويل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conv.map((r, i) => {
                      const rate = r.filter_hits > 0 
                        ? ((r.results_hits / r.filter_hits) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4 font-semibold">{r.country}</td>
                          <td className="py-2 px-4">{r.filter_hits.toLocaleString()}</td>
                          <td className="py-2 px-4">{r.results_hits.toLocaleString()}</td>
                          <td className="py-2 px-4">{rate}%</td>
                        </tr>
                      );
                    })}
                    {conv.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted-foreground">
                          لا توجد بيانات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Timeseries */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">
                Timeseries (آخر 14 يومًا) - عدد results_loaded لكل تبويب
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-2 px-2 sticky right-0 bg-card">اليوم</th>
                      {allTabs.map((tab, i) => (
                        <th key={i} className="text-right py-2 px-2">{tab}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(([d, row]) => (
                      <tr key={d} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 sticky right-0 bg-card font-medium">{d}</td>
                        {allTabs.map((tab, i) => (
                          <td key={i} className="py-2 px-2">
                            {(row as any)[tab] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {days.length === 0 && (
                      <tr>
                        <td colSpan={allTabs.length + 1} className="text-center py-4 text-muted-foreground">
                          لا توجد بيانات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
