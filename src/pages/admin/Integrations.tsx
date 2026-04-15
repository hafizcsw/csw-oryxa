import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { RefreshCw, Send } from "lucide-react";

type OutboxRow = {
  id: number;
  created_at: string;
  event_type: string;
  status: string;
  attempts: number;
  last_error?: string | null;
  next_attempt_at?: string | null;
};

export default function Integrations() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("integration_outbox")
        .select("id,created_at,event_type,status,attempts,last_error,next_attempt_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows(data || []);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "خطأ",
        description: "فشل تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runDispatch = async (onlyOne = false) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-dispatch', {
        body: { only_one: onlyOne }
      });

      if (error) throw error;

      if (data.skipped) {
        toast({
          title: "تم التخطي",
          description: data.reason,
        });
      } else {
        toast({
          title: "نجح الإرسال",
          description: `تم إرسال ${data.sent} عنصر، فشل ${data.failed}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل الإرسال",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
      load();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent": return "text-green-600";
      case "error": return "text-red-600";
      default: return "text-yellow-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "sent": return "تم الإرسال";
      case "error": return "خطأ";
      default: return "معلّق";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">التكاملات — CRM Outbox</h2>
          <div className="flex gap-2">
            <Button onClick={load} variant="outline" disabled={loading}>
              <RefreshCw className={`ml-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button
              onClick={() => runDispatch(true)}
              disabled={running}
              variant="outline"
            >
              <Send className="ml-2 h-4 w-4" />
              إرسال واحد
            </Button>
            <Button
              onClick={() => runDispatch(false)}
              disabled={running}
            >
              <Send className="ml-2 h-4 w-4" />
              إرسال دفعة
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold">ID</th>
                    <th className="text-right py-3 px-4 font-semibold">الحدث</th>
                    <th className="text-right py-3 px-4 font-semibold">الحالة</th>
                    <th className="text-right py-3 px-4 font-semibold">المحاولات</th>
                    <th className="text-right py-3 px-4 font-semibold">المحاولة القادمة</th>
                    <th className="text-right py-3 px-4 font-semibold">آخر خطأ</th>
                    <th className="text-right py-3 px-4 font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-sm">{r.id}</td>
                      <td className="py-3 px-4 font-mono text-sm">{r.event_type}</td>
                      <td className={`py-3 px-4 font-semibold ${getStatusColor(r.status)}`}>
                        {getStatusLabel(r.status)}
                      </td>
                      <td className="py-3 px-4">{r.attempts}</td>
                      <td className="py-3 px-4 text-sm">
                        {r.next_attempt_at
                          ? new Date(r.next_attempt_at).toLocaleString('ar-EG')
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm max-w-xs truncate">
                        {r.last_error ? (
                          <span className="text-destructive" title={r.last_error}>
                            {r.last_error}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {new Date(r.created_at).toLocaleString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد عناصر في قائمة الانتظار
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">معلومات التكامل</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• لتفعيل التكامل مع CRM، قم بتعيين <code className="bg-muted px-1 rounded">crm_enabled.enabled = true</code> في صفحة إعدادات الميزات</p>
            <p>• حدد عنوان webhook الخاص بـCRM في <code className="bg-muted px-1 rounded">crm_webhook_url</code></p>
            <p>• اضبط رمز المصادقة في <code className="bg-muted px-1 rounded">crm_auth_header</code></p>
            <p>• يتم إعادة المحاولة تلقائيًا مع backoff exponential حتى الوصول للحد الأقصى من المحاولات</p>
          </div>
        </div>
      </div>
    </div>
  );
}
