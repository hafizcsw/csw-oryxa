import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Download } from "lucide-react";

const CSV_TEMPLATE = `university_name,program_name,degree_slug,teaching_language,delivery_mode,tuition_yearly,currency_code,ielts_required,next_intake_date,duration_months
"University of London","BSc Computer Science","bachelor","en","on-campus",19000,"GBP",6.0,2025-09-01,36
"University of Manchester","MSc Data Science","master","en","on-campus",22000,"GBP",6.5,2026-01-15,24
"Technical University of Munich","BSc Informatik","bachelor","de","on-campus",500,"EUR",5.5,2025-10-01,36`;

export default function ImportPrograms() {
  const { toast } = useToast();
  const [csvData, setCsvData] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال بيانات CSV", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-import-programs-csv", {
        body: { csv_data: csvData },
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      setResult(data);
      toast({
        title: "نجح الاستيراد",
        description: `تم استيراد ${data.imported} برنامج${data.errors?.length ? ` (${data.errors.length} أخطاء)` : ""}`,
      });

      if (data.errors?.length === 0) {
        setCsvData(""); // Clear on full success
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "programs_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">استيراد البرامج من CSV</h2>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 ml-2" />
          تحميل القالب
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">بيانات CSV</label>
          <textarea
            className="w-full min-h-48 p-2 border rounded font-mono text-sm"
            placeholder="الصق بيانات CSV هنا..."
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            التنسيق المطلوب: university_name, program_name, degree_slug, teaching_language, delivery_mode, tuition_yearly, currency_code, ielts_required, next_intake_date, duration_months
          </p>
        </div>

        <Button onClick={handleImport} disabled={loading} className="w-full">
          <FileUp className="h-4 w-4 ml-2" />
          {loading ? "جاري الاستيراد..." : "استيراد البيانات"}
        </Button>
      </Card>

      {result && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">نتيجة الاستيراد</h3>
          <div className="space-y-1">
            <p className="text-sm">
              ✅ تم استيراد: <span className="font-bold">{result.imported}</span> برنامج
            </p>
            {result.errors?.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-destructive mb-1">
                  ⚠️ أخطاء ({result.errors.length}):
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((err: any, idx: number) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      السطر {err.line}: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 bg-muted/50">
        <h3 className="font-semibold mb-2">مثال على البيانات</h3>
        <pre className="text-xs overflow-x-auto">{CSV_TEMPLATE}</pre>
      </Card>
    </div>
  );
}
