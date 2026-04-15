import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface SEOData {
  seo_title?: string;
  seo_description?: string;
  seo_h1?: string;
  seo_canonical_url?: string;
  seo_index?: boolean;
  seo_last_reviewed_at?: string;
}

interface SEOEditorProps {
  data: SEOData;
  onSave: (data: SEOData) => Promise<void>;
  entityType: "university" | "program" | "scholarship" | "country";
  defaultValues?: {
    title?: string;
    description?: string;
    h1?: string;
    canonicalUrl?: string;
  };
}

export function SEOEditor({ data, onSave, entityType, defaultValues }: SEOEditorProps) {
  const [seoData, setSeoData] = useState<SEOData>(data || {
    seo_index: true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...seoData,
        seo_last_reviewed_at: new Date().toISOString(),
      });
      toast.success("تم حفظ إعدادات SEO بنجاح");
    } catch (error) {
      toast.error("فشل حفظ إعدادات SEO");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSeoData({
      seo_title: defaultValues?.title || "",
      seo_description: defaultValues?.description || "",
      seo_h1: defaultValues?.h1 || "",
      seo_canonical_url: defaultValues?.canonicalUrl || "",
      seo_index: true,
    });
  };

  const titleLength = seoData.seo_title?.length || 0;
  const descLength = seoData.seo_description?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>إعدادات SEO</span>
          <div className="flex items-center gap-2">
            {seoData.seo_last_reviewed_at && (
              <Badge variant="secondary" className="text-xs">
                آخر مراجعة: {new Date(seoData.seo_last_reviewed_at).toLocaleDateString('ar')}
              </Badge>
            )}
            <Badge variant={seoData.seo_index ? "default" : "destructive"}>
              {seoData.seo_index ? (
                <><Eye className="w-3 h-3 mr-1" /> مفهرس</>
              ) : (
                <><EyeOff className="w-3 h-3 mr-1" /> غير مفهرس</>
              )}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SEO Title */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="seo_title">عنوان الصفحة (Title Tag)</Label>
            <span className={`text-xs ${titleLength > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {titleLength}/60 حرف
            </span>
          </div>
          <Input
            id="seo_title"
            value={seoData.seo_title || ""}
            onChange={(e) => setSeoData({ ...seoData, seo_title: e.target.value })}
            placeholder={defaultValues?.title || "أدخل عنوان SEO..."}
            maxLength={70}
          />
          {titleLength > 60 && (
            <p className="text-xs text-destructive">⚠️ العنوان طويل جداً. يُفضل أقل من 60 حرف</p>
          )}
        </div>

        {/* SEO Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="seo_description">وصف الصفحة (Meta Description)</Label>
            <span className={`text-xs ${descLength > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {descLength}/160 حرف
            </span>
          </div>
          <Textarea
            id="seo_description"
            value={seoData.seo_description || ""}
            onChange={(e) => setSeoData({ ...seoData, seo_description: e.target.value })}
            placeholder={defaultValues?.description || "أدخل وصف SEO..."}
            rows={3}
            maxLength={200}
          />
          {descLength > 160 && (
            <p className="text-xs text-destructive">⚠️ الوصف طويل جداً. يُفضل أقل من 160 حرف</p>
          )}
        </div>

        {/* H1 */}
        <div className="space-y-2">
          <Label htmlFor="seo_h1">العنوان الرئيسي (H1)</Label>
          <Input
            id="seo_h1"
            value={seoData.seo_h1 || ""}
            onChange={(e) => setSeoData({ ...seoData, seo_h1: e.target.value })}
            placeholder={defaultValues?.h1 || "أدخل H1..."}
          />
          <p className="text-xs text-muted-foreground">
            💡 يجب أن يحتوي على الكلمات المفتاحية الرئيسية
          </p>
        </div>

        {/* Canonical URL */}
        <div className="space-y-2">
          <Label htmlFor="seo_canonical_url">الرابط القانوني (Canonical URL)</Label>
          <Input
            id="seo_canonical_url"
            value={seoData.seo_canonical_url || ""}
            onChange={(e) => setSeoData({ ...seoData, seo_canonical_url: e.target.value })}
            placeholder={defaultValues?.canonicalUrl || "https://example.com/..."}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            💡 اتركه فارغاً لاستخدام الرابط الحالي تلقائياً
          </p>
        </div>

        {/* Index/NoIndex */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="seo_index">فهرسة الصفحة في محركات البحث</Label>
            <p className="text-xs text-muted-foreground">
              {seoData.seo_index 
                ? "✅ الصفحة ستظهر في نتائج البحث" 
                : "⛔ الصفحة لن تظهر في نتائج البحث"}
            </p>
          </div>
          <Switch
            id="seo_index"
            checked={seoData.seo_index ?? true}
            onCheckedChange={(checked) => setSeoData({ ...seoData, seo_index: checked })}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            إعادة تعيين
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
