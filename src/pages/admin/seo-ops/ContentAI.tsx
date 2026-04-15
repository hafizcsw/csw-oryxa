import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, RefreshCw, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ContentAI() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("seo_ai_tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setTasks(data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runTasks() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-ai-daily', {
        body: { kinds: ['meta', 'faq', 'internal_links', 'content_gap'] }
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`${data.queued} مهمة جديدة`);
        load();
      } else {
        toast.error(data?.error || "Failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "معلّق" },
      running: { variant: "default", label: "جاري" },
      done: { variant: "outline", label: "تم" },
      error: { variant: "destructive", label: "خطأ" }
    };
    const v = variants[status] || variants.pending;
    return <Badge variant={v.variant as any}>{v.label}</Badge>;
  };

  const getKindLabel = (kind: string) => {
    const labels: Record<string, string> = {
      meta: "تحسين العناوين",
      faq: "توليد FAQ",
      internal_links: "روابط داخلية",
      content_gap: "فجوات المحتوى"
    };
    return labels[kind] || kind;
  };

  const summary = {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
    error: tasks.filter(t => t.status === 'error').length,
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">مهام الذكاء الاصطناعي اليومية</h1>
          <p className="text-sm text-muted-foreground mt-1">
            توليد وتحسين المحتوى باستخدام AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button onClick={runTasks} disabled={running} size="sm">
            <PlayCircle className="w-4 h-4 ml-2" />
            {running ? "جاري..." : "تشغيل المهام"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">معلّقة</div>
          <div className="text-2xl font-bold mt-1">{summary.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">جارية</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{summary.running}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">مكتملة</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{summary.done}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">أخطاء</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{summary.error}</div>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card className="p-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            لا توجد مهام. اضغط "تشغيل المهام" لإنشاء مهام جديدة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-3 font-medium">النوع</th>
                  <th className="text-right p-3 font-medium">الحالة</th>
                  <th className="text-right p-3 font-medium">تاريخ الإنشاء</th>
                  <th className="text-right p-3 font-medium">التحديث</th>
                  <th className="text-center p-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{getKindLabel(t.kind)}</td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(t.created_at).toLocaleString('ar')}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(t.updated_at).toLocaleString('ar')}
                    </td>
                    <td className="p-3 text-center">
                      {t.result && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedTask(t)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Result Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>نتيجة المهمة: {selectedTask && getKindLabel(selectedTask.kind)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">المدخلات:</div>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(selectedTask?.payload, null, 2)}
              </pre>
            </div>
            {selectedTask?.result && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">النتيجة:</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(selectedTask.result, null, 2)}
                </pre>
              </div>
            )}
            {selectedTask?.error && (
              <div>
                <div className="text-sm font-medium text-red-600 mb-2">خطأ:</div>
                <pre className="text-xs bg-red-50 text-red-900 p-3 rounded overflow-auto">
                  {selectedTask.error}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
