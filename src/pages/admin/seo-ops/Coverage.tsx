import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

export default function Coverage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      // Get latest snapshot
      const { data: latest, error: e1 } = await (supabase as any)
        .from("seo_index_coverage")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .single();
      
      if (e1 && e1.code !== 'PGRST116') throw e1;
      setSnapshot(latest);

      // Get history (last 14 days)
      const { data: hist, error: e2 } = await (supabase as any)
        .from("seo_index_coverage")
        .select("date, submitted, indexed, errors, warnings")
        .gte("date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order("date", { ascending: true });
      
      if (e2) throw e2;
      setHistory(hist || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-coverage-refresh');
      if (error) throw error;
      if (data?.ok) {
        toast.success("تم تحديث التغطية");
        load();
      } else {
        toast.error(data?.error || "Failed");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  const successRate = snapshot ? 
    ((snapshot.indexed / snapshot.submitted) * 100).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">تغطية الفهرسة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            حالة فهرسة الصفحات في محركات البحث
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 ml-2" />
          {refreshing ? "جاري..." : "تحديث"}
        </Button>
      </div>

      {loading ? (
        <Card className="p-6">
          <div className="text-center text-muted-foreground">جاري التحميل...</div>
        </Card>
      ) : !snapshot ? (
        <Card className="p-6">
          <div className="text-center text-muted-foreground">
            لا توجد بيانات. اضغط "تحديث" لجلب أحدث البيانات.
          </div>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-blue-50 dark:bg-blue-950">
              <div className="text-sm text-muted-foreground">مُرسل</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">
                {snapshot.submitted}
              </div>
            </Card>
            <Card className="p-4 bg-green-50 dark:bg-green-950">
              <div className="text-sm text-muted-foreground">مفهرس</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {snapshot.indexed}
              </div>
            </Card>
            <Card className="p-4 bg-red-50 dark:bg-red-950">
              <div className="text-sm text-muted-foreground">أخطاء</div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {snapshot.errors}
              </div>
            </Card>
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-950">
              <div className="text-sm text-muted-foreground">تحذيرات</div>
              <div className="text-2xl font-bold mt-1 text-yellow-600">
                {snapshot.warnings}
              </div>
            </Card>
          </div>

          {/* Success Rate */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">نسبة النجاح</h3>
                <p className="text-sm text-muted-foreground">
                  نسبة الصفحات المفهرسة من المُرسلة
                </p>
              </div>
              <div className="text-4xl font-bold text-primary">
                {successRate}%
              </div>
            </div>
            <div className="mt-4 w-full bg-secondary rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </Card>

          {/* Trend Chart */}
          {history.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">الاتجاه (14 يوم)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="indexed" 
                    stroke="hsl(var(--primary))" 
                    name="مفهرس"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="#ef4444" 
                    name="أخطاء"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="warnings" 
                    stroke="#f59e0b" 
                    name="تحذيرات"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Last Updated */}
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">
              آخر تحديث: {new Date(snapshot.created_at).toLocaleString('ar')}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
