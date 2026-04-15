import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, TrendingUp, Eye, Link, Brain } from "lucide-react";

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('seo-ops-overview');
      if (error) throw error;
      if (result?.ok) {
        setData(result.data);
      } else {
        throw new Error(result?.error || 'Failed to load');
      }
    } catch (e: any) {
      toast.error("فشل تحميل البيانات: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setScanning(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('seo-audit-scan');
      if (error) throw error;
      if (result?.ok) {
        toast.success(`تم الفحص: ${result.findings} مشكلة`);
        load();
      } else {
        toast.error(result?.error || 'فشل الفحص');
      }
    } catch (e: any) {
      toast.error("فشل الفحص: " + e.message);
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-muted-foreground">جاري التحميل...</div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-muted-foreground">لا توجد بيانات</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">نظرة عامة على SEO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ملخص شامل لحالة تحسين محركات البحث
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button onClick={runScan} disabled={scanning} size="sm">
            {scanning ? "جاري الفحص..." : "فحص الزحف"}
          </Button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-sm text-muted-foreground">نقرات (30 يوم)</div>
              <div className="text-2xl font-bold text-blue-600">
                {data.gsc?.last30?.clicks || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-3">
            <Eye className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm text-muted-foreground">ظهور (30 يوم)</div>
              <div className="text-2xl font-bold text-green-600">
                {data.gsc?.last30?.impressions || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-purple-50 dark:bg-purple-950">
          <div className="flex items-center gap-3">
            <Link className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-sm text-muted-foreground">روابط خلفية</div>
              <div className="text-2xl font-bold text-purple-600">
                {data.backlinks?.total || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-orange-50 dark:bg-orange-950">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-orange-600" />
            <div>
              <div className="text-sm text-muted-foreground">مهام AI قيد التنفيذ</div>
              <div className="text-2xl font-bold text-orange-600">
                {(data.ai?.pending || 0) + (data.ai?.running || 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Coverage Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">تغطية الفهرسة</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">مُرسل</div>
            <div className="text-xl font-bold">{data.coverage?.submitted || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">مفهرس</div>
            <div className="text-xl font-bold text-green-600">{data.coverage?.indexed || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">أخطاء</div>
            <div className="text-xl font-bold text-red-600">{data.coverage?.errors || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">تحذيرات</div>
            <div className="text-xl font-bold text-yellow-600">{data.coverage?.warnings || 0}</div>
          </div>
        </div>
      </Card>

      {/* Cron Jobs Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">حالة المهام المجدولة</h3>
        <div className="space-y-2">
          {data.cron?.map((job: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">{job.job_name}</div>
                <div className="text-sm text-muted-foreground">
                  {job.last_run_at ? new Date(job.last_run_at).toLocaleString('ar') : 'لم يتم التشغيل بعد'}
                </div>
              </div>
              <span className={`px-3 py-1 text-xs rounded ${
                job.status === 'ok' ? 'bg-green-100 text-green-700' :
                job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                job.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {job.status}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
