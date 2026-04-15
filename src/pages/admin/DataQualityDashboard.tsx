import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Play, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface QualityTest {
  id: number;
  run_at: string;
  scope: string;
  total_tested: number;
  correct_count: number;
  precision: number;
  recall: number;
  details: any;
  passed: boolean;
}

export default function DataQualityDashboard() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const { data: testsResponse, refetch } = useQuery({
    queryKey: ["quality-tests"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("quality-tests-list", {
        body: { limit: 10 }
      });
      if (error) throw error;
      return data;
    }
  });

  const tests: QualityTest[] = testsResponse?.tests || [];

  const runTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("golden-set-test", {
        body: { scope: "fees" }
      });

      if (error) throw error;

      toast({
        title: "اكتمل الاختبار",
        description: `الدقة: ${(data.test_run.precision * 100).toFixed(1)}%`,
        variant: data.test_run.passed ? "default" : "destructive"
      });

      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  const latest = tests?.[0];
  const previous = tests?.[1];
  const trend = latest && previous ? latest.precision - previous.precision : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">جودة البيانات</h1>
        <Button onClick={runTest} disabled={testing}>
          <Play className="w-4 h-4 ml-2" />
          {testing ? "جاري الاختبار..." : "تشغيل اختبار"}
        </Button>
      </div>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>آخر اختبار Golden Set</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">الدقة</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {(latest.precision * 100).toFixed(1)}%
                  {trend > 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : 
                   trend < 0 ? <TrendingDown className="w-5 h-5 text-red-600" /> : null}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">المختبرة</div>
                <div className="text-2xl font-bold">{latest.total_tested}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">الصحيحة</div>
                <div className="text-2xl font-bold text-green-600">{latest.correct_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">الحالة</div>
                <Badge variant={latest.passed ? "default" : "destructive"}>
                  {latest.passed ? "نجح" : "فشل"}
                </Badge>
              </div>
            </div>

            {!latest.passed && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">تحذير: الدقة تحت العتبة</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    الحد الأدنى: 85% | الفعلي: {(latest.precision * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>سجل الاختبارات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tests?.map((test) => (
              <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">
                    {format(new Date(test.run_at), "PPpp", { locale: ar })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {test.scope} • {test.correct_count}/{test.total_tested}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{(test.precision * 100).toFixed(1)}%</span>
                  <Badge variant={test.passed ? "default" : "destructive"}>
                    {test.passed ? "نجح" : "فشل"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
