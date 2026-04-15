// ============================================================================
// LEGACY: This integration logs page is currently NOT FULLY UTILIZED.
// ============================================================================
// The primary CRM integration is done via Supabase Functions:
//   - CRM_FUNCTIONS_URL: https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1
//   - CRM_API_KEY: csw_web_to_crm_xxx
//   - crmClient.ts: web-sync-student / web-sync-application / orchestrate-chat
//
// This page reads from integration_logs table via admin-logs-list function.
// Currently, the main crmClient.ts operations don't log to this table.
// Page is kept for future logging implementation but hidden from the UI.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LogEntry = {
  id: string;
  timestamp: string;
  type: string;
  event: string;
  target?: string;
  status?: string;
  error?: string;
  latency_ms?: number;
  payload: any;
};

export default function IntegrationLogs() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadLogs();
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [authLoading, isAdmin]);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase.functions.invoke('admin-logs-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (data?.items) {
        setLogs(data.items);
      }
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !isAdmin) {
    return <div className="container mx-auto p-6">جاري التحميل...</div>;
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Integration Logs</h1>
          <p className="text-gray-600">أحدث أحداث الإرسال (CRM/WhatsApp) والأخطاء</p>
        </div>
        <Button onClick={loadLogs} disabled={loading} variant="outline">
          {loading ? "جاري التحميل..." : "تحديث"}
        </Button>
      </div>
      
      {loading && logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          جاري التحميل...
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الوقت</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">النوع</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحدث</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الهدف</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحالة</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">التأخير</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الخطأ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      لا توجد سجلات متاحة
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString("ar-EG", {
                          dateStyle: "short",
                          timeStyle: "medium"
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="outline">{log.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{log.event}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.target || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {log.status && (
                          <Badge
                            variant={
                              log.status === "sent" || log.status === "completed"
                                ? "default"
                                : log.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {log.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.error ? (
                          <span className="text-xs text-red-600 line-clamp-2">
                            {log.error}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
