import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ExternalLink, Download } from "lucide-react";
import { InlineCell } from "@/components/admin/InlineCell";
import { useToast } from "@/hooks/use-toast";

type Program = {
  id: string;
  title: string;
  teaching_language?: string;
  delivery_mode?: string;
  tuition_yearly?: number;
  currency_code?: string;
  ielts_required?: number;
  next_intake_date?: string;
  duration_months?: number;
  city?: string;
};

export default function ProgramsList({ universityId }: { universityId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Program[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("programs")
        .select("id, title, teaching_language, delivery_mode, tuition_yearly, currency_code, ielts_required, next_intake_date, duration_months, city")
        .eq("university_id", universityId)
        .order("title");

      if (q) query = query.ilike("title", `%${q}%`);
      if (lang) query = query.eq("teaching_language", lang);

      const { data } = await query;
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, lang, universityId]);

  const updateField = async (programId: string, field: keyof Program, value: any) => {
    const { error } = await supabase
      .from("programs")
      .update({ [field]: value } as any)
      .eq("id", programId);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      throw error;
    }

    setRows((prev) =>
      prev.map((p) => (p.id === programId ? { ...p, [field]: value } : p))
    );
  };

  const exportCSV = () => {
    const headers = "program_name,teaching_language,delivery_mode,tuition_yearly,currency_code,ielts_required,next_intake_date,duration_months,city\n";
    const csvData = rows.map((r) =>
      `"${r.title}",${r.teaching_language || ""},${r.delivery_mode || ""},${r.tuition_yearly || ""},${r.currency_code || ""},${r.ielts_required || ""},${r.next_intake_date || ""},${r.duration_months || ""},${r.city || ""}`
    ).join("\n");
    
    const blob = new Blob([headers + csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "programs_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex gap-2 items-center">
        <Input
          placeholder="بحث عن برنامج…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <Select value={lang || undefined} onValueChange={(v) => setLang(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="كل اللغات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="tr">Türkçe</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" size="icon" onClick={exportCSV} title="تصدير CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-right p-2 sticky right-0 bg-muted/50">البرنامج</th>
              <th className="p-2">اللغة</th>
              <th className="p-2">النمط</th>
              <th className="p-2">الرسوم/سنة</th>
              <th className="p-2">العملة</th>
              <th className="p-2">IELTS</th>
              <th className="p-2">أقرب قبول</th>
              <th className="p-2">المدة (شهر)</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b hover:bg-muted/30">
                <td className="p-2 font-medium sticky right-0 bg-background">{r.title}</td>
                <td className="p-2">
                  <InlineCell
                    value={r.teaching_language}
                    onSave={(val) => updateField(r.id, "teaching_language", val)}
                    placeholder="en"
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.delivery_mode}
                    onSave={(val) => updateField(r.id, "delivery_mode", val)}
                    placeholder="on-campus"
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.tuition_yearly}
                    type="number"
                    onSave={(val) => updateField(r.id, "tuition_yearly", val)}
                    placeholder="0"
                    min={0}
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.currency_code}
                    onSave={(val) => updateField(r.id, "currency_code", val)}
                    placeholder="GBP"
                    className="uppercase"
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.ielts_required}
                    type="number"
                    onSave={(val) => updateField(r.id, "ielts_required", val)}
                    placeholder="6.0"
                    min={0}
                    max={9}
                    step={0.5}
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.next_intake_date}
                    type="date"
                    onSave={(val) => updateField(r.id, "next_intake_date", val)}
                    placeholder="2025-09-01"
                  />
                </td>
                <td className="p-2">
                  <InlineCell
                    value={r.duration_months}
                    type="number"
                    onSave={(val) => updateField(r.id, "duration_months", val)}
                    placeholder="12"
                    min={1}
                  />
                </td>
                <td className="p-2">
                  <a href={`/program/${r.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center p-4 text-muted-foreground">
                  لا توجد برامج
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
