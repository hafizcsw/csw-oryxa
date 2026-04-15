import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, Globe } from "lucide-react";

export default function BudgetDashboard() {
  const { data: budget } = useQuery({
    queryKey: ["harvest-budget"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("budget-check", {
        body: { period_type: "weekly" }
      });
      if (error) throw error;
      return data.budget;
    },
    refetchInterval: 60000 // كل دقيقة
  });

  if (!budget) {
    return <div className="container mx-auto p-6">جاري التحميل...</div>;
  }

  const tokensPercent = budget.tokens ? (budget.tokens.used / budget.tokens.budget) * 100 : 0;
  const crawlsPercent = budget.crawls ? (budget.crawls.used / budget.crawls.budget) * 100 : 0;
  const costPercent = budget.cost ? (budget.cost.used / budget.cost.budget) * 100 : 0;

  const getVariant = (percent: number) => {
    if (percent >= 90) return "destructive";
    if (percent >= 80) return "secondary";
    return "default";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ميزانية الحصاد</h1>
        <Badge variant={budget.available ? "default" : "destructive"}>
          {budget.available ? "متاح" : "تم التجاوز"}
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens المستخدمة</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {budget.tokens?.used?.toLocaleString() || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {budget.tokens?.budget?.toLocaleString() || 0}
                </span>
              </div>
              <Progress value={tokensPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {tokensPercent.toFixed(1)}% مستخدم
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عمليات الزحف</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {budget.crawls?.used?.toLocaleString() || 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {budget.crawls?.budget?.toLocaleString() || 0}
                </span>
              </div>
              <Progress value={crawlsPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {crawlsPercent.toFixed(1)}% مستخدم
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">التكلفة (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  ${budget.cost?.used?.toFixed(2) || "0.00"}
                </span>
                <span className="text-sm text-muted-foreground">
                  / ${budget.cost?.budget?.toFixed(2) || "0.00"}
                </span>
              </div>
              <Progress value={costPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {costPercent.toFixed(1)}% مستخدم
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!budget.available && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="bg-destructive/10 p-2 rounded">
                <DollarSign className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-medium text-destructive">تم تجاوز الميزانية</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  السبب: {budget.reason === 'budget_exceeded' ? 'تم تجاوز الحد المسموح' : 'غير محدد'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  سيتم إيقاف عمليات الحصاد التلقائية حتى بداية الفترة التالية.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
