// ============================================================================
// LEGACY: This integration is currently NOT USED.
// ============================================================================
// The primary CRM integration is done via Supabase Functions:
//   - CRM_FUNCTIONS_URL: https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1
//   - CRM_API_KEY: csw_web_to_crm_xxx
//   - crmClient.ts: web-sync-student / web-sync-application / orchestrate-chat
//
// This page is kept for reference but hidden from the UI.
// The integration_outbox table and crm-dispatch function are not actively used.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import RunDispatcher from "@/components/admin/RunDispatcher";

export default function Outbox() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const { data: items } = await supabase
        .from("integration_outbox")
        .select("id, status, created_at, event_type")
        .eq("target", "crm")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: counts } = await supabase
        .from("integration_outbox")
        .select("status")
        .eq("target", "crm");

      const summary = { pending: 0, sent: 0, error: 0 };
      counts?.forEach((item: any) => {
        if (item.status in summary) summary[item.status as keyof typeof summary]++;
      });

      setData({ items, counts: summary });
    } catch (error) {
      console.error("Error loading outbox:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="admin-container">Loading...</div>;

  return (
    <div dir="rtl" className="admin-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">CRM Outbox</h1>
        <RunDispatcher />
      </div>
      
      <div className="admin-card mb-4">
        <div className="flex gap-4">
          <span>Pending: <strong>{data?.counts?.pending || 0}</strong></span>
          <span>Sent: <strong>{data?.counts?.sent || 0}</strong></span>
          <span>Error: <strong>{data?.counts?.error || 0}</strong></span>
        </div>
      </div>

      <div className="admin-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-right p-2">ID</th>
              <th className="text-right p-2">Event</th>
              <th className="text-right p-2">Status</th>
              <th className="text-right p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="text-right p-2 text-sm">{item.id.slice(0, 8)}</td>
                <td className="text-right p-2 text-sm">{item.event_type}</td>
                <td className="text-right p-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'sent' ? 'bg-green-100 text-green-800' :
                    item.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="text-right p-2 text-sm">
                  {new Date(item.created_at).toLocaleString('ar')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
