import { useEffect, useState } from "react";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { verifyAdminSSOFromURL } from "@/lib/admin.sso";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    site_readonly: false,
    contact_email: "",
    contact_whatsapp: "",
    contact_address: "",
    currency: "USD"
  });

  useEffect(() => {
    const init = async () => {
      const { ok } = await verifyAdminSSOFromURL();
      if (!ok) {
        window.location.href = "/";
        return;
      }
      await loadSettings();
    };
    init();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("id", true)
        .single();
      
      if (data) {
        setSettings({
          site_readonly: data.site_readonly || false,
          contact_email: data.contact_email || "",
          contact_whatsapp: data.contact_whatsapp || "",
          contact_address: data.contact_address || "",
          currency: data.currency || "USD"
        });
      }
    } catch (error) {
      console.error("Load settings error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("settings")
        .update(settings)
        .eq("id", true);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully."
      });
    } catch (error) {
      console.error("Save settings error:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePingCRM = async () => {
    try {
      const { error } = await supabase.functions.invoke("bridge-flush");
      if (error) throw error;
      toast({
        title: "CRM pinged",
        description: "Integration events flushed successfully."
      });
    } catch (error) {
      console.error("Ping CRM error:", error);
      toast({
        title: "Error",
        description: "Failed to ping CRM",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <>
        <div className="max-w-4xl mx-auto px-4 py-6">Loading...</div>
      </>
    );
  }

  return (
    <>
      <section className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">System Settings</h1>

        <div className="space-y-6">
          <div className="rounded-xl border bg-background p-6">
            <h2 className="text-lg font-semibold mb-4">General Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Read-Only Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Disable all write operations (applications, uploads)
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.site_readonly}
                    onChange={(e) => setSettings({ ...settings, site_readonly: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact Email</label>
                <input
                  type="email"
                  className="w-full border rounded-xl px-4 py-2 bg-background"
                  value={settings.contact_email}
                  onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact WhatsApp</label>
                <input
                  type="tel"
                  className="w-full border rounded-xl px-4 py-2 bg-background"
                  value={settings.contact_whatsapp}
                  onChange={(e) => setSettings({ ...settings, contact_whatsapp: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contact Address</label>
                <textarea
                  className="w-full border rounded-xl px-4 py-2 bg-background"
                  rows={3}
                  value={settings.contact_address}
                  onChange={(e) => setSettings({ ...settings, contact_address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Currency</label>
                <select
                  className="w-full border rounded-xl px-4 py-2 bg-background"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-6">
            <h2 className="text-lg font-semibold mb-4">Integration</h2>
            <DSButton onClick={handlePingCRM} variant="outline">
              Ping CRM (Flush Events)
            </DSButton>
          </div>

          <div className="flex gap-3">
            <DSButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </DSButton>
            <DSButton variant="outline" onClick={loadSettings}>
              Reset
            </DSButton>
          </div>
        </div>
      </section>
    </>
  );
}
