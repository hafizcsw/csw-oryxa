import { useEffect, useState } from "react";
import { verifyAdminSSOFromURL, requireAdmin } from "@/lib/admin.sso";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function AdminAnalytics() {
  const [ok, setOk] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  useEffect(() => {
    (async () => {
      const { ok } = await verifyAdminSSOFromURL(); 
      setOk(ok); 
      requireAdmin(ok);
    })();
  }, []);

  const { data: visits = 0 } = useQuery({
    queryKey: ["analytics-visits", period],
    queryFn: async () => {
      const date = new Date();
      if (period === "day") date.setDate(date.getDate() - 1);
      else if (period === "week") date.setDate(date.getDate() - 7);
      else date.setMonth(date.getMonth() - 1);

      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("name", "page_view")
        .gte("created_at", date.toISOString());
      return count || 0;
    },
    enabled: ok,
  });

  const { data: chats = 0 } = useQuery({
    queryKey: ["analytics-chats", period],
    queryFn: async () => {
      const date = new Date();
      if (period === "day") date.setDate(date.getDate() - 1);
      else if (period === "week") date.setDate(date.getDate() - 7);
      else date.setMonth(date.getMonth() - 1);

      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("name", ["chat_started", "assistant_processed"])
        .gte("created_at", date.toISOString());
      return count || 0;
    },
    enabled: ok,
  });

  const { data: leads = 0 } = useQuery({
    queryKey: ["analytics-leads", period],
    queryFn: async () => {
      const date = new Date();
      if (period === "day") date.setDate(date.getDate() - 1);
      else if (period === "week") date.setDate(date.getDate() - 7);
      else date.setMonth(date.getMonth() - 1);

      const { count } = await supabase
        .from("integration_events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "lead.created")
        .gte("created_at", date.toISOString());
      return count || 0;
    },
    enabled: ok,
  });

  const { data: serviceClicks = 0 } = useQuery({
    queryKey: ["analytics-service-clicks", period],
    queryFn: async () => {
      const date = new Date();
      if (period === "day") date.setDate(date.getDate() - 1);
      else if (period === "week") date.setDate(date.getDate() - 7);
      else date.setMonth(date.getMonth() - 1);

      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("name", "service_icon_clicked")
        .gte("created_at", date.toISOString());
      return count || 0;
    },
    enabled: ok,
  });

  if (!ok) return null;

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <select
            className="px-4 py-2 rounded-lg border"
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <Card k="Page Views" v={visits}/>
          <Card k="Chat Sessions" v={chats}/>
          <Card k="New Leads" v={leads}/>
          <Card k="Service Clicks" v={serviceClicks}/>
        </div>
        <p className="text-gray-500 mt-6 text-sm">* Real-time data from events and integration_events tables.</p>
      </section>
    </>
  );
}

function Card({k,v}:{k:string;v:number}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-500">{k}</div>
      <div className="text-2xl font-semibold mt-1">{v.toLocaleString()}</div>
    </div>
  );
}