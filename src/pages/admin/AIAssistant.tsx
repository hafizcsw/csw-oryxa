import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Suggestion = {
  id: string;
  field: string;
  proposed_value: any;
  confidence: number;
  status: string;
};

export default function AIAssistant() {
  const { toast } = useToast();
  const [programId, setProgramId] = useState("");
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const analyze = async () => {
    if (!programId || !urls) {
      toast({ title: "خطأ", description: "معرّف البرنامج والروابط مطلوبة", variant: "destructive" });
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

      setSuggestions(sugs || []);
      toast({ title: "نجح", description: `تم إنشاء ${sugs?.length || 0} اقتراح` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const approve = async (suggestionId: string, field: string, value: any) => {
    try {
      // Update program
      await supabase
        .from("programs")
        .update({ [field]: value } as any)
        .eq("id", programId);

      // Update suggestion status
      await supabase
        .from("ai_enrichment_suggestions")
        .update({ status: "approved", approved_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", suggestionId);

      setSuggestions((s) => s.filter((sg) => sg.id !== suggestionId));
      toast({ title: "نجح", description: "تم قبول الاقتراح" });
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

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">مساعد البيانات الذكي</h2>
      </div>

      <Card className="p-4 space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">معرّف البرنامج (UUID)</label>
          <Input
            placeholder="12345678-1234-1234-1234-123456789012"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">روابط رسمية (سطر لكل رابط)</label>
          <textarea
            className="w-full min-h-24 p-2 border rounded"
            placeholder="https://university.edu/programs/bsc-cs&#10;https://university.edu/admissions/requirements"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
        </div>

        <Button onClick={analyze} disabled={loading} className="w-full">
          {loading ? "جاري التحليل..." : "تحليل واقتراح"}
        </Button>
      </Card>

      {suggestions.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">الاقتراحات ({suggestions.length})</h3>
          <div className="space-y-2">
            {suggestions.map((sg) => (
              <div key={sg.id} className="flex items-center gap-2 p-2 border rounded">
                <div className="flex-1">
                  <div className="font-medium">{sg.field}</div>
                  <div className="text-sm text-muted-foreground">
                    القيمة المقترحة: {JSON.stringify(sg.proposed_value)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    الثقة: {(sg.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => approve(sg.id, sg.field, sg.proposed_value)}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => reject(sg.id)}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
