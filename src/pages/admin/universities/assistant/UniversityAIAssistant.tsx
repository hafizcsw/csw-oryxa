import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Suggestion = {
  id: string;
  field: string;
  proposed_value: any;
  confidence: number;
  status: string;
  program_id?: string;
};

type UniversityAIAssistantProps = {
  universityId: string;
};

export default function UniversityAIAssistant({ universityId }: UniversityAIAssistantProps) {
  const { toast } = useToast();
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  useEffect(() => {
    loadPrograms();
  }, [universityId]);

  const loadPrograms = async () => {
    const { data } = await supabase
      .from("programs")
      .select("id, title")
      .eq("university_id", universityId)
      .order("title");

    setPrograms(data || []);
  };

  const analyze = async (programId: string) => {
    if (!urls.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال روابط رسمية", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const urlList = urls.split("\n").map((u) => u.trim()).filter(Boolean);

      const { data, error } = await supabase.functions.invoke("ai-enrich-programs", {
        body: { program_id: programId, source_urls: urlList },
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      // Load suggestions
      const { data: sugs } = await supabase
        .from("ai_enrichment_suggestions")
        .select("*")
        .eq("job_id", data.job_id)
        .eq("status", "pending");

      const sugsWithProgram = (sugs || []).map((s) => ({ ...s, program_id: programId }));
      setSuggestions((prev) => [...prev, ...sugsWithProgram]);
      
      toast({ title: "نجح", description: `تم إنشاء ${sugs?.length || 0} اقتراح` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const approve = async (suggestion: Suggestion) => {
    try {
      const programId = suggestion.program_id;
      if (!programId) return;

      // Update program
      await supabase
        .from("programs")
        .update({ [suggestion.field]: suggestion.proposed_value } as any)
        .eq("id", programId);

      // Update suggestion status
      const { data: user } = await supabase.auth.getUser();
      await supabase
        .from("ai_enrichment_suggestions")
        .update({ status: "approved", approved_by: user.user?.id })
        .eq("id", suggestion.id);

      setSuggestions((s) => s.filter((sg) => sg.id !== suggestion.id));
      toast({ title: "نجح", description: "تم قبول الاقتراح وتحديث البرنامج" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const reject = async (suggestionId: string) => {
    try {
      await supabase
        .from("ai_enrichment_suggestions")
        .update({ status: "rejected" })
        .eq("id", suggestionId);

      setSuggestions((s) => s.filter((sg) => sg.id !== suggestionId));
      toast({ title: "تم", description: "تم رفض الاقتراح" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      tuition_yearly: "الرسوم/سنة",
      ielts_required: "IELTS",
      next_intake_date: "أقرب قبول",
      duration_months: "المدة",
      teaching_language: "اللغة",
      currency_code: "العملة",
    };
    return labels[field] || field;
  };

  const formatValue = (field: string, value: any) => {
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value?.toString() || "—";
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">مساعد البيانات الذكي</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">
              روابط رسمية (سطر لكل رابط)
            </label>
            <Textarea
              placeholder="https://university.edu/programs/bsc-cs&#10;https://university.edu/admissions/requirements"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              أدخل روابط رسمية من موقع الجامعة (.edu, .ac.uk, .de, .tr)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">اختر البرنامج للتحليل</label>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                >
                  <span className="text-sm">{program.title}</span>
                  <Button
                    size="sm"
                    onClick={() => analyze(program.id)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 ml-2" />
                    )}
                    تحليل
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {suggestions.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">الاقتراحات ({suggestions.length})</h3>
          <div className="space-y-3">
            {suggestions.map((sg) => {
              const program = programs.find((p) => p.id === sg.program_id);
              return (
                <div
                  key={sg.id}
                  className="flex items-start gap-3 p-3 border rounded hover:bg-muted/30"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getFieldLabel(sg.field)}</Badge>
                      {program && (
                        <span className="text-xs text-muted-foreground">
                          {program.title}
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      القيمة المقترحة:{" "}
                      <span className="font-medium">
                        {formatValue(sg.field, sg.proposed_value)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${sg.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(sg.confidence * 100).toFixed(0)}% ثقة
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => approve(sg)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reject(sg.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">ملاحظات هامة</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• يتم قبول الروابط من نطاقات الجامعات الرسمية فقط (.edu, .ac, إلخ)</li>
          <li>• الاقتراحات تحتاج موافقة يدوية قبل التطبيق</li>
          <li>• يتم استخراج: الرسوم، IELTS، مواعيد القبول، المدة، اللغة</li>
          <li>• الثقة المنخفضة (&lt;50%) تحتاج مراجعة دقيقة</li>
        </ul>
      </Card>
    </div>
  );
}
