import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Image, Upload } from "lucide-react";

type MediaManagerProps = {
  universityId: string;
};

export default function MediaManager({ universityId }: MediaManagerProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [university, setUniversity] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUniversity();
  }, [universityId]);

  const loadUniversity = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("universities")
      .select("logo_url")
      .eq("id", universityId)
      .single();

    if (data) {
      setUniversity(data);
      setLogoUrl(data.logo_url || "");
    }
    setLoading(false);
  };

  const saveLogo = async () => {
    const { error } = await supabase
      .from("universities")
      .update({ logo_url: logoUrl })
      .eq("id", universityId);

    if (error) {
      toast({ title: t("admin.media.error"), description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: t("admin.media.saved") });
    setUniversity((prev: any) => ({ ...prev, logo_url: logoUrl }));
  };

  if (loading) {
    return <div className="p-4">{t("admin.media.loading")}</div>;
  }

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="logo-url">{t("admin.media.logoUrl")}</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <Button onClick={saveLogo}>
                <Upload className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t("admin.media.save")}
              </Button>
            </div>
          </div>

          {logoUrl && (
            <div className="border rounded p-4 flex items-center justify-center bg-muted/20">
              <img
                src={logoUrl}
                alt={t("admin.media.universityLogo")}
                className="max-h-32 object-contain"
                onError={() => toast({ title: t("admin.media.error"), description: t("admin.media.imageLoadError"), variant: "destructive" })}
              />
            </div>
          )}

          {!logoUrl && (
            <div className="border-2 border-dashed rounded p-8 flex flex-col items-center justify-center text-muted-foreground">
              <Image className="h-12 w-12 mb-2" />
              <p>{t("admin.media.noLogo")}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">{t("admin.media.note")}</h3>
        <p className="text-sm text-muted-foreground">
          • {t("admin.media.tips.transparent")}
          <br />
          • {t("admin.media.tips.size")}
          <br />
          • {t("admin.media.tips.https")}
        </p>
      </Card>
    </div>
  );
}
