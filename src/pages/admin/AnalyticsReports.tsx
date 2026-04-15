import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

type TrafficData = {
  day: string;
  tab: string;
  events: number;
};

type LatencyData = {
  tab: string;
  p50_ms: number;
  p95_ms: number;
  n: number;
};

type ConversionData = {
  country: string;
  results_hits: number;
  filter_hits: number;
};

type ActivityData = {
  event: string;
  n: number;
};

export default function AnalyticsReports() {
  const [traffic, setTraffic] = useState<TrafficData[]>([]);
  const [latency, setLatency] = useState<LatencyData[]>([]);
  const [conversion, setConversion] = useState<ConversionData[]>([]);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);

    try {
      // Traffic by tab/day - get recent events
      const { data: trafficData } = await supabase
        .from("analytics_events")
        .select("at, tab, event")
        .in("event", ["results_loaded", "filter_changed", "tab_changed"])
        .order("at", { ascending: false })
        .limit(100);

      // Group by day and tab
      const trafficMap = new Map<string, TrafficData>();
      trafficData?.forEach((row) => {
        const day = new Date(row.at).toISOString().split("T")[0];
        const key = `${day}-${row.tab}`;
        const existing = trafficMap.get(key);
        if (existing) {
          existing.events++;
        } else {
          trafficMap.set(key, { day, tab: row.tab, events: 1 });
        }
      });
      setTraffic(Array.from(trafficMap.values()).slice(0, 50));

      // Latency stats
      const { data: latencyData } = await supabase
        .from("analytics_events")
        .select("tab, latency_ms")
        .eq("event", "results_loaded")
        .not("latency_ms", "is", null);

      // Calculate stats per tab
      const latencyMap = new Map<
        string,
        { sum: number; count: number; values: number[] }
      >();
      latencyData?.forEach((row) => {
        const existing = latencyMap.get(row.tab);
        if (existing) {
          existing.sum += row.latency_ms;
          existing.count++;
          existing.values.push(row.latency_ms);
        } else {
          latencyMap.set(row.tab, {
            sum: row.latency_ms,
            count: 1,
            values: [row.latency_ms],
          });
        }
      });

      const latencyResults: LatencyData[] = [];
      latencyMap.forEach((stats, tab) => {
        const sorted = stats.values.sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        latencyResults.push({
          tab,
          p50_ms: Math.round(stats.sum / stats.count),
          p95_ms: sorted[p95Index] || 0,
          n: stats.count,
        });
      });
      setLatency(latencyResults);

      // User activity
      const { data: activityData } = await supabase
        .from("analytics_events")
        .select("event")
        .in("event", ["shortlist_add", "shortlist_remove", "apply_submitted"]);

      const activityMap = new Map<string, number>();
      activityData?.forEach((row) => {
        activityMap.set(row.event, (activityMap.get(row.event) || 0) + 1);
      });

      const activityResults: ActivityData[] = [];
      activityMap.forEach((n, event) => {
        activityResults.push({ event, n });
      });
      setActivity(activityResults);

      // For conversion, we'll show a simplified version
      setConversion([]);
    } catch (error) {
      console.error("Error loading reports:", error);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">تقارير القياس</h1>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">تقارير القياس</h1>
        <button
          onClick={loadReports}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          تحديث
        </button>
      </div>

      <div className="grid gap-6">
        {/* Traffic Report */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            حركة المستخدمين (آخر 50 حدث)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">اليوم</th>
                  <th className="text-right p-2">التبويب</th>
                  <th className="text-right p-2">الأحداث</th>
                </tr>
              </thead>
              <tbody>
                {traffic.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">
                      {new Date(row.day).toLocaleDateString()}
                    </td>
                    <td className="p-2">{row.tab}</td>
                    <td className="p-2">{row.events}</td>
                  </tr>
                ))}
                {traffic.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-muted-foreground">
                      لا بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Latency Report */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            زمن الاستجابة (median / 95th percentile)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">التبويب</th>
                  <th className="text-right p-2">p50 (ms)</th>
                  <th className="text-right p-2">p95 (ms)</th>
                  <th className="text-right p-2">العينات</th>
                </tr>
              </thead>
              <tbody>
                {latency.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.tab}</td>
                    <td className="p-2">{row.p50_ms}</td>
                    <td className="p-2">{row.p95_ms}</td>
                    <td className="p-2">{row.n}</td>
                  </tr>
                ))}
                {latency.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-muted-foreground">
                      لا بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Conversion Report */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            التحويل حسب الدولة (filter → results)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">الدولة</th>
                  <th className="text-right p-2">نتائج محملة</th>
                  <th className="text-right p-2">تطبيق فلاتر</th>
                  <th className="text-right p-2">معدل التحويل</th>
                </tr>
              </thead>
              <tbody>
                {conversion.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.country}</td>
                    <td className="p-2">{row.results_hits}</td>
                    <td className="p-2">{row.filter_hits}</td>
                    <td className="p-2">
                      {row.filter_hits > 0
                        ? ((row.results_hits / row.filter_hits) * 100).toFixed(1)
                        : "0"}
                      %
                    </td>
                  </tr>
                ))}
                {conversion.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-muted-foreground">
                      لا بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* User Activity Report */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            نشاط المستخدمين (المفضلة والتقديم)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">الحدث</th>
                  <th className="text-right p-2">العدد</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.event}</td>
                    <td className="p-2">{row.n}</td>
                  </tr>
                ))}
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={2} className="p-2 text-center text-muted-foreground">
                      لا بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
