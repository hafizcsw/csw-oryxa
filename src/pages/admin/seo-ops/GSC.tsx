import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";

export default function GSC() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [propertyUrl, setPropertyUrl] = useState('');
  const [svcEmail, setSvcEmail] = useState('');
  const [svcKeyPem, setSvcKeyPem] = useState('');
  const [isDailySync, setIsDailySync] = useState(false);

  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: config, error: e1 } = await (supabase as any)
        .from('seo_gsc_config')
        .select('*')
        .limit(1)
        .single();
      
      if (e1 && e1.code !== 'PGRST116') throw e1;
      
      if (config) {
        setPropertyUrl(config.property_url || '');
        setSvcEmail(config.svc_email || '');
        setSvcKeyPem(config.svc_key_pem || '');
        setIsDailySync(config.is_daily_sync || false);
      }

      const { data: recent } = await (supabase as any)
        .from('seo_gsc_daily')
        .select('*')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (recent && recent.length > 0) {
        const totalClicks = recent.reduce((sum: number, r: any) => sum + (r.total_clicks || 0), 0);
        const totalImpressions = recent.reduce((sum: number, r: any) => sum + (r.total_impressions || 0), 0);
        setMetrics({
          clicks: totalClicks,
          impressions: totalImpressions,
          ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00'
        });
      }
    } catch (e: any) {
      toast.error("فشل التحميل: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('admin-seo-gsc-save', {
        body: {
          property_url: propertyUrl,
          svc_email: svcEmail,
          svc_key_pem: svcKeyPem,
          is_daily_sync: isDailySync
        }
      });
      if (error) throw error;
      toast.success("تم الحفظ");
    } catch (e: any) {
      toast.error("فشل الحفظ: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-sync', {
        body: { reason: 'manual' }
      });
      if (error) throw error;
      toast.success("تمت المزامنة");
      load();
    } catch (e: any) {
      toast.error("فشلت المزامنة: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Google Search Console</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إعدادات المزامنة والمقاييس
          </p>
        </div>
        <Button onClick={sync} disabled={syncing || !propertyUrl} size="sm">
          <RefreshCw className="w-4 h-4 ml-2" />
          {syncing ? "جاري المزامنة..." : "Sync Now"}
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950">
            <div className="text-sm text-muted-foreground">نقرات (30 يوم)</div>
            <div className="text-2xl font-bold text-blue-600">{metrics.clicks}</div>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-950">
            <div className="text-sm text-muted-foreground">ظهور (30 يوم)</div>
            <div className="text-2xl font-bold text-green-600">{metrics.impressions}</div>
          </Card>
          <Card className="p-4 bg-purple-50 dark:bg-purple-950">
            <div className="text-sm text-muted-foreground">CTR (30 يوم)</div>
            <div className="text-2xl font-bold text-purple-600">{metrics.ctr}%</div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">الإعدادات</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="propertyUrl">Property URL</Label>
            <Input
              id="propertyUrl"
              value={propertyUrl}
              onChange={(e) => setPropertyUrl(e.target.value)}
              placeholder="https://example.com/"
            />
          </div>
          
          <div>
            <Label htmlFor="svcEmail">Service Account Email</Label>
            <Input
              id="svcEmail"
              value={svcEmail}
              onChange={(e) => setSvcEmail(e.target.value)}
              placeholder="service-account@project.iam.gserviceaccount.com"
            />
          </div>
          
          <div>
            <Label htmlFor="svcKeyPem">Private Key (PEM)</Label>
            <Textarea
              id="svcKeyPem"
              value={svcKeyPem}
              onChange={(e) => setSvcKeyPem(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              rows={6}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isDailySync"
              type="checkbox"
              checked={isDailySync}
              onChange={(e) => setIsDailySync(e.target.checked)}
            />
            <Label htmlFor="isDailySync">تفعيل المزامنة اليومية التلقائية</Label>
          </div>

          <Button onClick={save} disabled={saving || !propertyUrl}>
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
