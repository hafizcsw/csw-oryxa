import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLookups } from "@/hooks/useLookups";
import { DSButton } from "@/components/design-system/DSButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  country_id: string;
  city?: string | null;
  event_type?: string | null;
  start_at: string;
  end_at?: string | null;
  organizer?: string | null;
  url?: string | null;
  is_online?: boolean | null;
  venue_name?: string | null;
  description?: string | null;
  country_name?: string | null;
};

export default function EventsAdmin() {
  const { countries } = useLookups();
  const { toast } = useToast();
  const [rows, setRows] = useState<EventItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s
      ? rows
      : rows.filter(
          r =>
            r.title.toLowerCase().includes(s) ||
            (r.organizer && r.organizer.toLowerCase().includes(s))
        );
  }, [rows, q]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("education_events")
      .select(
        "id,title,country_id,city,event_type,start_at,end_at,organizer,url,is_online,venue_name,description,countries(name_ar)"
      )
      .order("start_at", { ascending: true });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    }
    const mapped = (data || []).map((r: any) => ({
      ...r,
      country_name: r.countries?.name_ar || "—",
    }));
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفعالية؟")) return;
    const { error } = await supabase.from("education_events").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
      return;
    }
    toast({ title: "تم الحذف بنجاح" });
    setRows(prev => prev.filter(x => x.id !== id));
  };

  const save = async () => {
    if (!editing) return;
    const { id, country_name, ...payload } = editing as any;
    let err;
    if (id) {
      const { error } = await supabase.from("education_events").update(payload).eq("id", id);
      err = error;
    } else {
      const { error } = await supabase.from("education_events").insert(payload);
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
          <h1 className="text-3xl font-bold mb-2">إدارة الفعاليات</h1>
          <p className="text-muted-foreground">إضافة وتعديل وحذف الفعاليات</p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <Input
            placeholder="بحث بالعنوان أو المنظم..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="max-w-xs"
          />
          <DSButton
            variant="primary"
            onClick={() =>
              setEditing({
                title: "",
                country_id: "",
                start_at: new Date().toISOString().slice(0, 16),
              })
            }
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة فعالية
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
                  <th className="p-4 font-semibold">الدولة</th>
                  <th className="p-4 font-semibold">المدينة</th>
                  <th className="p-4 font-semibold">النوع</th>
                  <th className="p-4 font-semibold">التاريخ (بداية)</th>
                  <th className="p-4 font-semibold">المنظم</th>
                  <th className="p-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-4 font-medium">{r.title}</td>
                    <td className="p-4">{r.country_name}</td>
                    <td className="p-4">{r.city || (r.is_online ? "أونلاين" : "—")}</td>
                    <td className="p-4">{r.event_type || "—"}</td>
                    <td className="p-4">
                      {r.start_at ? new Date(r.start_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-4">{r.organizer || "—"}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <DSButton variant="outline" size="sm" onClick={() => setEditing(r)}>
                          <Pencil className="w-4 h-4" />
                        </DSButton>
                        <DSButton
                          variant="outline"
                          size="sm"
                          onClick={() => remove(r.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </DSButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-12 text-muted-foreground">
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
                {editing.id ? "تعديل فعالية" : "إضافة فعالية"}
              </h2>
              <div className="grid gap-4">
                <div>
                  <Label>عنوان الفعالية *</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))}
                    placeholder="مثال: Study Abroad Fair"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الدولة *</Label>
                    <Select
                      value={editing.country_id || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, country_id: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدولة" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>المدينة</Label>
                    <Input
                      value={editing.city || ""}
                      onChange={e => setEditing(p => ({ ...p!, city: e.target.value }))}
                      placeholder="دبي، الرياض..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>النوع</Label>
                    <Select
                      value={editing.event_type || ""}
                      onValueChange={val => setEditing(p => ({ ...p!, event_type: val || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">لا شيء</SelectItem>
                        <SelectItem value="fair">معرض</SelectItem>
                        <SelectItem value="webinar">ندوة عبر الإنترنت</SelectItem>
                        <SelectItem value="workshop">ورشة عمل</SelectItem>
                        <SelectItem value="seminar">ندوة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>المنظم</Label>
                    <Input
                      value={editing.organizer || ""}
                      onChange={e => setEditing(p => ({ ...p!, organizer: e.target.value }))}
                      placeholder="اسم الجهة المنظمة"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>تاريخ ووقت البداية *</Label>
                    <Input
                      type="datetime-local"
                      value={editing.start_at || ""}
                      onChange={e => setEditing(p => ({ ...p!, start_at: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>تاريخ ووقت النهاية</Label>
                    <Input
                      type="datetime-local"
                      value={editing.end_at || ""}
                      onChange={e =>
                        setEditing(p => ({ ...p!, end_at: e.target.value || null }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>رابط التسجيل</Label>
                    <Input
                      value={editing.url || ""}
                      onChange={e => setEditing(p => ({ ...p!, url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>اسم المكان</Label>
                    <Input
                      value={editing.venue_name || ""}
                      onChange={e => setEditing(p => ({ ...p!, venue_name: e.target.value }))}
                      placeholder="مثال: قاعة المؤتمرات"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_online"
                    checked={!!editing.is_online}
                    onCheckedChange={checked =>
                      setEditing(p => ({ ...p!, is_online: checked as boolean }))
                    }
                  />
                  <Label htmlFor="is_online" className="cursor-pointer">
                    فعالية أونلاين
                  </Label>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea
                    value={editing.description || ""}
                    onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))}
                    placeholder="وصف مختصر عن الفعالية..."
                    rows={3}
                  />
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
