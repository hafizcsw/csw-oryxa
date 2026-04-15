import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, RefreshCw, X } from "lucide-react";

interface TickerSettings {
  enabled: boolean;
  text_en: string;
  label_en: string;
  bg_color: string;
  label_color: string;
  text_color: string;
  speed_seconds: number;
}

const defaultSettings: TickerSettings = {
  enabled: true,
  text_en: "🚀 BREAKING: ORYXA Coin Coming Soon!",
  label_en: "BREAKING",
  bg_color: "#111827",
  label_color: "#DC2626",
  text_color: "#FFFFFF",
  speed_seconds: 15,
};

export default function NewsTickerSettings() {
  const [settings, setSettings] = useState<TickerSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feature_settings')
        .select('value')
        .eq('key', 'news_ticker')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.value) {
        setSettings({
          ...defaultSettings,
          ...(data.value as Record<string, unknown>),
        });
      }
    } catch (e: unknown) {
      console.error('[NewsTickerSettings] Load error:', e);
      toast({
        title: "خطأ في التحميل",
        description: "حدث خطأ أثناء تحميل الإعدادات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      // Use raw SQL approach via update since type definitions are strict
      const { error } = await supabase
        .from('feature_settings')
        .update({ 
          value: JSON.parse(JSON.stringify(settings))
        })
        .eq('key', 'news_ticker');

      if (error) {
        console.error('[NewsTickerSettings] Update error:', error);
        throw error;
      }

      toast({
        title: "✅ تم الحفظ بنجاح",
        description: "تم حفظ إعدادات شريط الأخبار"
      });
    } catch (e: unknown) {
      console.error('[NewsTickerSettings] Save error:', e);
      toast({
        title: "خطأ في الحفظ",
        description: e instanceof Error ? e.message : "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">📰 إعدادات شريط الأخبار</h1>
        <p className="text-muted-foreground mt-1">
          تحكم كامل في شريط الأخبار الذي يظهر أعلى الصفحة الرئيسية
        </p>
      </div>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle>معاينة حية</CardTitle>
          <CardDescription>هذا ما سيظهر للزوار - يُترجم تلقائياً حسب لغة المستخدم</CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="w-full rounded-lg overflow-hidden shadow-lg"
            style={{ backgroundColor: settings.bg_color }}
          >
            <div className="flex items-center">
              {/* Label Badge */}
              <div 
                className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2"
                style={{ backgroundColor: settings.label_color, color: '#FFFFFF' }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                {settings.label_en}
              </div>
              
              {/* Scrolling Text */}
              <div className="flex-1 overflow-hidden py-2 sm:py-3">
                <div 
                  className="whitespace-nowrap font-medium text-xs sm:text-sm tracking-wide"
                  style={{ 
                    color: settings.text_color,
                    animation: `marquee ${settings.speed_seconds}s linear infinite`
                  }}
                >
                  {settings.text_en}
                  {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                  {settings.text_en}
                  {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                  {settings.text_en}
                </div>
              </div>
              
              {/* Close Button Preview */}
              <button
                className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 transition-colors"
                style={{ color: `${settings.text_color}99` }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enable/Disable Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">تفعيل شريط الأخبار</Label>
              <p className="text-sm text-muted-foreground">إظهار أو إخفاء الشريط من الصفحة الرئيسية</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={async (checked) => {
                const newSettings = { ...settings, enabled: checked };
                setSettings(newSettings);
                // Save immediately on toggle
                try {
                  const { error } = await supabase
                    .from('feature_settings')
                    .update({ value: JSON.parse(JSON.stringify(newSettings)) })
                    .eq('key', 'news_ticker');
                  if (error) throw error;
                  toast({
                    title: checked ? "✅ تم تفعيل شريط الأخبار" : "⛔ تم تعطيل شريط الأخبار",
                  });
                } catch (e) {
                  console.error('[NewsTickerSettings] Toggle error:', e);
                  setSettings({ ...newSettings, enabled: !checked }); // revert
                  toast({ title: "خطأ في الحفظ", variant: "destructive" });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Text Content */}
      <Card>
        <CardHeader>
          <CardTitle>📝 المحتوى النصي</CardTitle>
          <CardDescription>اكتب بالإنجليزية - يُترجم تلقائياً للغة المستخدم</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Label / Badge (مثل BREAKING)</Label>
            <Input
              value={settings.label_en}
              onChange={(e) => setSettings({ ...settings, label_en: e.target.value })}
              placeholder="BREAKING"
              className="mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label>نص الشريط الرئيسي</Label>
            <Textarea
              value={settings.text_en}
              onChange={(e) => setSettings({ ...settings, text_en: e.target.value })}
              placeholder="🚀 Your news here..."
              rows={3}
              className="mt-1"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 يمكنك استخدام الإيموجي 🎉 والفواصل • للفصل بين الأخبار
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>🎨 الألوان</CardTitle>
          <CardDescription>خصص ألوان الشريط حسب علامتك التجارية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>لون الخلفية</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={settings.bg_color}
                  onChange={(e) => setSettings({ ...settings, bg_color: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                />
                <Input
                  value={settings.bg_color}
                  onChange={(e) => setSettings({ ...settings, bg_color: e.target.value })}
                  className="flex-1"
                  dir="ltr"
                />
              </div>
            </div>
            
            <div>
              <Label>لون Label</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={settings.label_color}
                  onChange={(e) => setSettings({ ...settings, label_color: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                />
                <Input
                  value={settings.label_color}
                  onChange={(e) => setSettings({ ...settings, label_color: e.target.value })}
                  className="flex-1"
                  dir="ltr"
                />
              </div>
            </div>
            
            <div>
              <Label>لون النص</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={settings.text_color}
                  onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                />
                <Input
                  value={settings.text_color}
                  onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                  className="flex-1"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Speed Control */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ سرعة الحركة</CardTitle>
          <CardDescription>تحكم في سرعة تمرير النص</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>بطيء</span>
            <span className="font-medium">{settings.speed_seconds} ثانية للدورة الكاملة</span>
            <span>سريع</span>
          </div>
          <Slider
            value={[settings.speed_seconds]}
            onValueChange={(values) => setSettings({ ...settings, speed_seconds: values[0] })}
            min={5}
            max={30}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            قيمة أقل = سرعة أعلى | قيمة أكبر = سرعة أبطأ
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
          حفظ التغييرات
        </Button>
        <Button variant="outline" onClick={loadSettings} size="lg">
          <RefreshCw className="w-4 h-4 ml-2" />
          إعادة تحميل
        </Button>
      </div>
    </div>
  );
}
