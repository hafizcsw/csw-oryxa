import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function TuitionMonitor() {
  const [countryFilter, setCountryFilter] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("pg");
  const [audience, setAudience] = useState("international");
  const queryClient = useQueryClient();

  const { data: universities, isLoading } = useQuery({
    queryKey: ["tuition-monitor", countryFilter, degreeLevel, audience],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-tuition-list", {
        body: { country_code: countryFilter || undefined, degree_level: degreeLevel, audience }
      });
      if (error) throw error;
      return data;
    }
  });

  const refreshMutation = useMutation({
    mutationFn: async (params: { country_code?: string; limit?: number }) => {
      const { data, error } = await supabase.functions.invoke("tuition-refresh-run", {
        body: { ...params, degree_level: degreeLevel, audience }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم تحديث ${data.changed} جامعة من أصل ${data.processed}`);
      queryClient.invalidateQueries({ queryKey: ["tuition-monitor"] });
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    }
  });

  const getDiffBadge = (diffPercent: number | null) => {
    if (!diffPercent) return null;
    
    const variant = diffPercent <= 5 ? "default" : diffPercent <= 15 ? "secondary" : "destructive";
    const color = diffPercent <= 5 ? "text-success" : diffPercent <= 15 ? "text-warning" : "text-destructive";
    
    return (
      <Badge variant={variant} className={color}>
        {diffPercent > 0 ? "+" : ""}{diffPercent.toFixed(1)}%
      </Badge>
    );
  };

  const exportCSV = () => {
    if (!universities?.universities) return;
    
    const csv = [
      ["الجامعة", "الدولة", "السعر الرسمي", "العملة", "السنة", "الوسيط الثانوي", "الفارق%"].join(","),
      ...universities.universities.map((u: any) => [
        u.name,
        u.country_code,
        u.official_amount || "N/A",
        u.currency || "N/A",
        u.academic_year || "N/A",
        u.aux_median || "N/A",
        u.diff_percent || "0"
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuition-monitor-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">مراقبة الرسوم الدراسية</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!universities?.universities?.length}>
            <Download className="w-4 h-4 ml-2" />
            تصدير CSV
          </Button>
          <Button 
            onClick={() => refreshMutation.mutate({ country_code: countryFilter || undefined, limit: 10 })}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            تحديث الآن
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">الدولة</label>
              <Input 
                placeholder="رمز الدولة (مثل: GB, US)" 
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">المستوى الدراسي</label>
              <Select value={degreeLevel} onValueChange={setDegreeLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ug">بكالوريوس</SelectItem>
                  <SelectItem value="pg">ماجستير</SelectItem>
                  <SelectItem value="phd">دكتوراه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">نوع الطالب</label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="international">دولي</SelectItem>
                  <SelectItem value="home">محلي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الجامعة</TableHead>
                <TableHead className="text-right">الدولة</TableHead>
                <TableHead className="text-right">السعر الرسمي</TableHead>
                <TableHead className="text-right">السنة</TableHead>
                <TableHead className="text-right">الوسيط الثانوي</TableHead>
                <TableHead className="text-right">الفارق</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : universities?.universities?.length ? (
                universities.universities.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.country_code}</TableCell>
                    <TableCell>
                      {u.official_amount ? `${u.official_amount} ${u.currency}` : "N/A"}
                    </TableCell>
                    <TableCell>{u.academic_year || "N/A"}</TableCell>
                    <TableCell>
                      {u.aux_median ? `${u.aux_median} ${u.currency}` : "N/A"}
                    </TableCell>
                    <TableCell>{getDiffBadge(u.diff_percent)}</TableCell>
                    <TableCell>
                      {u.source_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={u.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    لا توجد بيانات
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
