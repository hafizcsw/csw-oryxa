import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Activity, TrendingUp, TrendingDown, Scan } from "lucide-react";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function DataQuality() {
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>("DE");

  // Fetch quality report
  const { data: report } = useQuery({
    queryKey: ["data-quality-report", selectedCountry],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("data-quality-report", {
        body: { entity_type: "country", entity_id: selectedCountry },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (country_code: string) => {
      const { data, error } = await supabase.functions.invoke("data-quality-scan", {
        body: { country_code, entity_type: "country" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Quality scan completed: ${data.score}/100`);
      queryClient.invalidateQueries({ queryKey: ["data-quality-report"] });
    },
    onError: (error) => {
      toast.error(`Scan failed: ${error.message}`);
    },
  });

  const latest = report?.latest_snapshot;
  const score = latest?.score || 0;
  const trend = report?.summary?.trend || 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  const chartData = report?.history?.map((s: any) => ({
    date: new Date(s.created_at).toLocaleDateString(),
    score: s.score,
  })) || [];

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Data Quality</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="GB">UK</SelectItem>
                <SelectItem value="US">USA</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => scanMutation.mutate(selectedCountry)}
              disabled={scanMutation.isPending}
            >
              <Scan className="w-4 h-4 mr-2" />
              Scan Now
            </Button>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score.toFixed(1)}</div>
              <Progress value={score} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {trend >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-success" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-destructive" />
                )}
                <span className={`text-2xl font-bold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
                  {trend >= 0 ? "+" : ""}{trend.toFixed(1)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{latest?.rules_passed || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {latest?.rules_failed || 0} failed
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score History Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Quality Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report?.rules?.map((rule: any) => {
                const passed = score >= rule.threshold;
                return (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{rule.rule_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Threshold: {rule.threshold}% · Weight: {rule.weight}
                      </div>
                    </div>
                    <Badge variant={passed ? "default" : "destructive"}>
                      {passed ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}