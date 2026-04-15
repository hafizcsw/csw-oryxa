import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface VisitorSparklineProps {
  hours?: number;
}

export function VisitorSparkline({ hours = 1 }: VisitorSparklineProps) {
  const [data, setData] = useState<Array<{ value: number }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: events } = await supabase
          .from("events")
          .select("created_at")
          .eq("name", "page_view")
          .gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: true });

        if (!events || events.length === 0) {
          setData([]);
          return;
        }

        // Group by 5-minute intervals
        const intervals = 12 * hours; // 12 intervals per hour
        const intervalMs = (hours * 60 * 60 * 1000) / intervals;
        const now = Date.now();
        const startTime = now - (hours * 60 * 60 * 1000);

        const buckets = new Array(intervals).fill(0);
        
        events.forEach(event => {
          const eventTime = new Date(event.created_at).getTime();
          const bucketIndex = Math.floor((eventTime - startTime) / intervalMs);
          if (bucketIndex >= 0 && bucketIndex < intervals) {
            buckets[bucketIndex]++;
          }
        });

        setData(buckets.map(value => ({ value })));
      } catch (error) {
        console.error("Error fetching sparkline data:", error);
        setData([]);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [hours]);

  if (data.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-muted-foreground">
        لا توجد بيانات
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
