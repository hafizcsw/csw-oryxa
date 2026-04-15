import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Star, Shield, Ban, Save, Loader2 } from "lucide-react";

interface CSWUniversityGuidance {
  university_id: string;
  partner_tier: string | null;
  csw_star: boolean;
  do_not_offer: boolean;
  do_not_offer_reason: string | null;
  pitch_public_i18n: Record<string, string>;
  pitch_staff_i18n: Record<string, string>;
  selling_points: string[];
  objections: string[];
  internal_notes: string | null;
  priority_score: number;
}

interface CSWGuidanceEditorProps {
  universityId: string;
  universityName: string;
  onSaved?: () => void;
}

const PARTNER_TIERS = [
  { value: "platinum", label: "بلاتينيوم", color: "bg-purple-500" },
  { value: "gold", label: "ذهبي", color: "bg-yellow-500" },
  { value: "silver", label: "فضي", color: "bg-gray-400" },
  { value: "bronze", label: "برونزي", color: "bg-orange-600" },
  { value: "none", label: "بدون شراكة", color: "bg-gray-200" }
];

export function CSWGuidanceEditor({ universityId, universityName, onSaved }: CSWGuidanceEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guidance, setGuidance] = useState<CSWUniversityGuidance>({
    university_id: universityId,
    partner_tier: "none",
    csw_star: false,
    do_not_offer: false,
    do_not_offer_reason: null,
    pitch_public_i18n: { ar: "", en: "" },
    pitch_staff_i18n: { ar: "", en: "" },
    selling_points: [],
    objections: [],
    internal_notes: null,
    priority_score: 0
  });

  const [newSellingPoint, setNewSellingPoint] = useState("");
  const [newObjection, setNewObjection] = useState("");

  useEffect(() => {
    loadGuidance();
  }, [universityId]);

  async function loadGuidance() {
    setLoading(true);
    const { data, error } = await supabase
      .from("csw_university_guidance")
      .select("*")
      .eq("university_id", universityId)
      .maybeSingle();

    if (data) {
      setGuidance({
        ...data,
        pitch_public_i18n: (typeof data.pitch_public_i18n === 'object' && data.pitch_public_i18n !== null && !Array.isArray(data.pitch_public_i18n)) 
          ? data.pitch_public_i18n as Record<string, string>
          : { ar: "", en: "" },
        pitch_staff_i18n: (typeof data.pitch_staff_i18n === 'object' && data.pitch_staff_i18n !== null && !Array.isArray(data.pitch_staff_i18n))
          ? data.pitch_staff_i18n as Record<string, string>
          : { ar: "", en: "" },
        selling_points: data.selling_points || [],
        objections: data.objections || []
      });
    }
    setLoading(false);
  }

  async function saveGuidance() {
    setSaving(true);
    
    const { error } = await supabase
      .from("csw_university_guidance")
      .upsert({
        university_id: universityId,
        partner_tier: guidance.partner_tier,
        csw_star: guidance.csw_star,
        do_not_offer: guidance.do_not_offer,
        do_not_offer_reason: guidance.do_not_offer_reason,
        pitch_public_i18n: guidance.pitch_public_i18n,
        pitch_staff_i18n: guidance.pitch_staff_i18n,
        selling_points: guidance.selling_points,
        objections: guidance.objections,
        internal_notes: guidance.internal_notes,
        priority_score: guidance.priority_score
      }, { onConflict: "university_id" });

    setSaving(false);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات CSW" });
      onSaved?.();
    }
  }

  function addSellingPoint() {
    if (newSellingPoint.trim()) {
      setGuidance(g => ({
        ...g,
        selling_points: [...g.selling_points, newSellingPoint.trim()]
      }));
      setNewSellingPoint("");
    }
  }

  function removeSellingPoint(index: number) {
    setGuidance(g => ({
      ...g,
      selling_points: g.selling_points.filter((_, i) => i !== index)
    }));
  }

  function addObjection() {
    if (newObjection.trim()) {
      setGuidance(g => ({
        ...g,
        objections: [...g.objections, newObjection.trim()]
      }));
      setNewObjection("");
    }
  }

  function removeObjection(index: number) {
    setGuidance(g => ({
      ...g,
      objections: g.objections.filter((_, i) => i !== index)
    }));
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={20} />
          CSW Guidance - {universityName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Partner Tier & Star */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>مستوى الشراكة</Label>
            <Select 
              value={guidance.partner_tier || "none"} 
              onValueChange={(v) => setGuidance(g => ({ ...g, partner_tier: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_TIERS.map(tier => (
                  <SelectItem key={tier.value} value={tier.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${tier.color}`} />
                      {tier.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>أولوية العرض</Label>
            <Input
              type="number"
              value={guidance.priority_score}
              onChange={(e) => setGuidance(g => ({ ...g, priority_score: parseInt(e.target.value) || 0 }))}
              min={0}
              max={100}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Star size={16} className="text-yellow-500" />
                جامعة مميزة (CSW Star)
              </Label>
              <Switch
                checked={guidance.csw_star}
                onCheckedChange={(v) => setGuidance(g => ({ ...g, csw_star: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-destructive">
                <Ban size={16} />
                منع العرض
              </Label>
              <Switch
                checked={guidance.do_not_offer}
                onCheckedChange={(v) => setGuidance(g => ({ ...g, do_not_offer: v }))}
              />
            </div>
          </div>
        </div>

        {/* Do Not Offer Reason */}
        {guidance.do_not_offer && (
          <div className="space-y-2">
            <Label className="text-destructive">سبب منع العرض</Label>
            <Textarea
              value={guidance.do_not_offer_reason || ""}
              onChange={(e) => setGuidance(g => ({ ...g, do_not_offer_reason: e.target.value }))}
              placeholder="اذكر سبب منع عرض هذه الجامعة..."
              className="border-destructive"
            />
          </div>
        )}

        {/* Public Pitch */}
        <div className="space-y-2">
          <Label>الـPitch للعميل (عربي)</Label>
          <Textarea
            value={guidance.pitch_public_i18n?.ar || ""}
            onChange={(e) => setGuidance(g => ({
              ...g,
              pitch_public_i18n: { ...g.pitch_public_i18n, ar: e.target.value }
            }))}
            placeholder="لماذا نوصي بهذه الجامعة؟ (يظهر للعميل)"
            rows={2}
          />
        </div>

        {/* Staff Pitch */}
        <div className="space-y-2">
          <Label>ملاحظات للموظفين (عربي)</Label>
          <Textarea
            value={guidance.pitch_staff_i18n?.ar || ""}
            onChange={(e) => setGuidance(g => ({
              ...g,
              pitch_staff_i18n: { ...g.pitch_staff_i18n, ar: e.target.value }
            }))}
            placeholder="ملاحظات داخلية للفريق (لا تظهر للعميل)"
            rows={2}
          />
        </div>

        {/* Selling Points */}
        <div className="space-y-2">
          <Label>نقاط البيع (Selling Points)</Label>
          <div className="flex gap-2">
            <Input
              value={newSellingPoint}
              onChange={(e) => setNewSellingPoint(e.target.value)}
              placeholder="أضف نقطة بيع..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSellingPoint())}
            />
            <Button type="button" onClick={addSellingPoint} variant="secondary">
              إضافة
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {guidance.selling_points.map((point, i) => (
              <Badge key={i} variant="default" className="cursor-pointer" onClick={() => removeSellingPoint(i)}>
                {point} ×
              </Badge>
            ))}
          </div>
        </div>

        {/* Objections */}
        <div className="space-y-2">
          <Label>الاعتراضات المتوقعة</Label>
          <div className="flex gap-2">
            <Input
              value={newObjection}
              onChange={(e) => setNewObjection(e.target.value)}
              placeholder="أضف اعتراض متوقع..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObjection())}
            />
            <Button type="button" onClick={addObjection} variant="secondary">
              إضافة
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {guidance.objections.map((obj, i) => (
              <Badge key={i} variant="outline" className="cursor-pointer border-orange-500 text-orange-600" onClick={() => removeObjection(i)}>
                {obj} ×
              </Badge>
            ))}
          </div>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <Label>ملاحظات داخلية</Label>
          <Textarea
            value={guidance.internal_notes || ""}
            onChange={(e) => setGuidance(g => ({ ...g, internal_notes: e.target.value }))}
            placeholder="ملاحظات إضافية..."
            rows={3}
          />
        </div>

        {/* Save Button */}
        <Button onClick={saveGuidance} disabled={saving} className="w-full">
          {saving ? <Loader2 className="animate-spin ml-2" /> : <Save className="ml-2" size={18} />}
          حفظ إعدادات CSW
        </Button>
      </CardContent>
    </Card>
  );
}
