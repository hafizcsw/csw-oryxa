import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLookups } from "@/hooks/useLookups";
import { DSButton } from "@/components/design-system/DSButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

type Scholarship = {
  id: string;
  title: string;
  country_id?: string | null;
  university_id?: string | null;
  degree_id?: string | null;
  program_id?: string | null;
  amount?: number | null;
  deadline?: string | null;
  url?: string | null;
  source?: string | null;
  status?: string | null;
  university_name?: string | null;
  country_name?: string | null;
  degree_name?: string | null;
  program_name?: string | null;
};

type Program = {
  id: string;
  title: string;
};

export default function ScholarshipsAdmin() {
  const { countries, degrees } = useLookups();
  const { toast } = useToast();
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [rows, setRows] = useState<Scholarship[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Scholarship> | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s
      ? rows
      : rows.filter(
          r =>
            r.title.toLowerCase().includes(s) ||
            (r.university_name && r.university_name.toLowerCase().includes(s)) ||
            (r.source && r.source.toLowerCase().includes(s))
        );
  }, [rows, q]);

  const loadUniversities = async () => {
    const { data } = await supabase.from("universities").select("id,name").order("name");
    setUniversities(data || []);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scholarships")
      .select(
        "id,title,country_id,university_id,degree_id,program_id,amount,deadline,url,source,status,countries(name_ar),universities(name),degrees(name),programs(title)"
      )
      .order("deadline", { ascending: true });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
    const mapped = (data || []).map((r: any) => ({
      ...r,
      country_name: r.countries?.name_ar || "—",
      university_name: r.universities?.name || "—",
      degree_name: r.degrees?.name || "—",
      program_name: r.programs?.title || null,
    }));
    setRows(mapped);
    setLoading(false);
  };

  const loadProgramsForUniversity = async (universityId: string) => {
    if (!universityId) {
      setPrograms([]);
      return;
    }
    const { data } = await supabase
      .from("programs")
      .select("id, title")
      .eq("university_id", universityId)
      .eq("is_active", true)
      .order("title");
    setPrograms(data || []);
  };

  useEffect(() => {
    loadUniversities();
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المنحة؟")) return;
    const { error } = await supabase.from("scholarships").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
      return;
    }
    toast({ title: "تم الحذف بنجاح" });
    setRows(prev => prev.filter(x => x.id !== id));
  };

  const save = async () => {
    if (!editing) return;
    const { id, university_name, country_name, degree_name, ...payload } = editing as any;
    let err;
    if (id) {
      const { error } = await supabase.from("scholarships").update(payload).eq("id", id);
      err = error;
    } else {
      const { error } = await supabase.from("scholarships").insert(payload);
      err = error;
    }
    if (err) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
      return;
    }
    toast({ title: id ? "تم التحديث بنجاح" : "تمت الإضافة بنجاح" });
    setEditing(null);
    await load();
  };

  return (
    <>
      <div className="container mx-auto py-8 px-4" dir="rtl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">إدارة المنح الدراسية</h1>
          <p className="text-muted-foreground">إضافة وتعديل وحذف المنح</p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <Input
            placeholder="بحث بالعنوان أو الجهة..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="max-w-xs"
          />
          <DSButton variant="primary" onClick={() => setEditing({ title: "" })}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة منحة
          </DSButton>
          <DSButton variant="outline" onClick={load}>
            تحديث
          </DSButton>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-4 font-semibold">العنوان</th>
                  <th className="p-4 font-semibold">الجهة/الجامعة</th>
                  <th className="p-4 font-semibold">الدولة</th>
                  <th className="p-4 font-semibold">المستوى</th>
                  <th className="p-4 font-semibold">البرنامج</th>
                  <th className="p-4 font-semibold">القيمة</th>
                  <th className="p-4 font-semibold">آخر موعد</th>
                  <th className="p-4 font-semibold">الحالة</th>
                  <th className="p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{r.title}</td>
                    <td className="p-4">{r.source || r.university_name}</td>
                    <td className="p-4">{r.country_name}</td>
                    <td className="p-4">{r.degree_name}</td>
                    <td className="p-4 text-sm">{r.program_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-4">{r.amount ?? "—"}</td>
                    <td className="p-4">{r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}</td>
                    <td className="p-4">{r.status || "—"}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <DSButton variant="outline" size="sm" onClick={() => setEditing(r)}>
                          <Pencil className="w-4 h-4" />
                        </DSButton>
                        <DSButton variant="outline" size="sm" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </DSButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-muted-foreground">
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg border max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editing.id ? "تعديل منحة" : "إضافة منحة"}
              </h2>
              <div className="grid gap-4">
                <div>
                  <Label>عنوان المنحة *</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))}
                    placeholder="مثال: International Excellence Scholarship"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الدولة</Label>
                    <Select
                      value={editing.country_id || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, country_id: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدولة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">لا شيء</SelectItem>
                        {countries.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الجامعة</Label>
                    <Select
                      value={editing.university_id || ""}
                      onValueChange={val => {
                        setEditing(p => ({ ...p!, university_id: val || null, program_id: null }));
                        loadProgramsForUniversity(val);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الجامعة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">لا شيء</SelectItem>
                        {universities.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>المستوى</Label>
                    <Select
                      value={editing.degree_id || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, degree_id: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المستوى" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">لا شيء</SelectItem>
                        {degrees.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>البرنامج المرتبط</Label>
                    <Select
                      value={editing.program_id || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, program_id: val || null }))}
                      disabled={!editing.university_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={editing.university_id ? "اختر البرنامج" : "اختر الجامعة أولاً"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">لا يوجد ربط</SelectItem>
                        {programs.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>القيمة</Label>
                    <Input
                      type="number"
                      value={editing.amount ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, amount: Number(e.target.value) || null }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>آخر موعد</Label>
                    <Input
                      type="date"
                      value={editing.deadline ?? ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, deadline: e.target.value || null }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>رابط التقديم</Label>
                    <Input
                      value={editing.url || ""}
                      onChange={e => setEditing(p => ({ ...p!, url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>الجهة المقدمة</Label>
                    <Input
                      value={editing.source || ""}
                      onChange={e => setEditing(p => ({ ...p!, source: e.target.value }))}
                      placeholder="اسم المؤسسة أو الجهة"
                    />
                  </div>
                </div>
                <div>
                  <Label>الحالة</Label>
                  <Select
                    value={editing.status || ""}
                    onValueChange={val => setEditing(p => ({ ...p!, status: val || null }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">لا شيء</SelectItem>
                      <SelectItem value="published">منشورة</SelectItem>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="expired">منتهية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <DSButton variant="primary" onClick={save}>
                  حفظ
                </DSButton>
                <DSButton variant="outline" onClick={() => setEditing(null)}>
                  إلغاء
                </DSButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
