import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { InlineCell } from "@/components/admin/InlineCell";
import { 
  GraduationCap, 
  Globe, 
  Pencil,
  Home
} from "lucide-react";
import InstitutionRankingPanel from "./InstitutionRankingPanel";

type UniversityOverviewProps = {
  universityId: string;
};

export default function UniversityOverview({ universityId }: UniversityOverviewProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [university, setUniversity] = useState<any>(null);
  const [stats, setStats] = useState({
    programCount: 0,
    minIelts: null as number | null,
    avgFees: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [universityId]);

  const loadData = async () => {
    setLoading(true);
    
    // Load university with country
    const { data: uni } = await supabase
      .from("universities")
      .select(`
        *,
        countries:country_id (id, name_ar, slug)
      `)
      .eq("id", universityId)
      .single();
    
    if (uni) {
      setUniversity(uni);
    }

    // Load stats
    const { data: programs } = await supabase
      .from("programs")
      .select("ielts_required, tuition_yearly")
      .eq("university_id", universityId);

    if (programs) {
      setStats({
        programCount: programs.length,
        minIelts: programs.reduce((min, p) => 
          p.ielts_required && (!min || p.ielts_required < min) ? p.ielts_required : min, 
          null as number | null
        ) || null,
        avgFees: programs.length 
          ? programs.reduce((sum, p) => sum + (p.tuition_yearly || 0), 0) / programs.length 
          : null,
      });
    }

    setLoading(false);
  };

  const updateUniversity = async (field: string, value: any) => {
    const { error } = await supabase
      .from("universities")
      .update({ [field]: value } as any)
      .eq("id", universityId);

    if (error) {
      toast({ title: t("admin.overview.error"), description: error.message, variant: "destructive" });
      throw error;
    }

    setUniversity((prev: any) => ({ ...prev, [field]: value }));
    toast({ title: t("admin.overview.saved") });
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'main_image_url' | 'logo_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 9MB)
    if (file.size > 9 * 1024 * 1024) {
      toast({
        title: t("admin.overview.error"),
        description: t("admin.overview.fileSizeError"),
        variant: "destructive",
      });
      return;
    }

    setUploading(field);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${universityId}/${field}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("universities")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("universities")
        .getPublicUrl(fileName);

      // Update database
      await updateUniversity(field, urlData.publicUrl);

      toast({ title: t("admin.overview.imageUploaded") });
    } catch (error: any) {
      toast({
        title: t("admin.overview.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <div className="p-4">{t("admin.overview.loading")}</div>;
  }

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header Card with Unified Layout */}
      <Card className="p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-start">
          {/* Left: Main Image */}
          <div className="relative group">
            <img 
              src={university?.main_image_url || '/placeholder.svg'} 
              alt={university?.name}
              className="w-full h-48 object-cover rounded-lg border-2"
            />
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              id="main-image-upload"
              onChange={(e) => handleImageUpload(e, 'main_image_url')}
            />
            <label htmlFor="main-image-upload">
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer">
                <Pencil className="h-8 w-8 text-white" />
              </div>
            </label>
            <p className="text-xs text-destructive mt-1">{t("admin.overview.maxUpload")}</p>
          </div>

          {/* Middle: University Name + Toggle */}
          <div className="space-y-4 min-w-[300px]">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <InlineCell
                value={university?.name}
                onSave={(val) => updateUniversity('name', val)}
                className="text-2xl font-bold"
              />
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>{university?.countries?.name_ar || university?.city}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox 
                id="show-home"
                checked={university?.show_in_home ?? false}
                onCheckedChange={(val) => updateUniversity('show_in_home', val)}
              />
              <Label htmlFor="show-home">{t("admin.overview.showInHome")}</Label>
            </div>

            {university?.show_in_home && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t("admin.overview.displayOrder")}</Label>
                <Input
                  type="number"
                  value={university?.display_order ?? 100}
                  onChange={(e) => updateUniversity('display_order', Number(e.target.value))}
                  className="w-24 h-8"
                />
              </div>
            )}
          </div>

          {/* Right: Logo */}
          <div className="relative group">
            <img 
              src={university?.logo_url || '/placeholder.svg'} 
              alt="Logo"
              className="w-48 h-48 object-contain rounded-lg border p-4 bg-muted/30"
            />
            <Input
              type="file"
              accept="image/*"
              className="hidden"
              id="logo-upload"
              onChange={(e) => handleImageUpload(e, 'logo_url')}
            />
            <label htmlFor="logo-upload">
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer">
                <Pencil className="h-8 w-8 text-white" />
              </div>
            </label>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 mt-6 pt-6 border-t">
          <Badge variant="outline" className="px-4 py-2">
            <GraduationCap className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {stats.programCount} {t("admin.overview.programs")}
          </Badge>
          <Badge variant="outline" className="px-4 py-2">
            <Globe className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t("admin.overview.ranking")}: #{university?.ranking || '—'}
          </Badge>
          {stats.minIelts && (
            <Badge variant="outline" className="px-4 py-2">
              IELTS: {stats.minIelts}+
            </Badge>
          )}
          {stats.avgFees && (
            <Badge variant="outline" className="px-4 py-2">
              {t("admin.overview.avgFees")}: ${Math.round(stats.avgFees).toLocaleString()}
            </Badge>
          )}
        </div>
      </Card>

      {/* University Housing Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Home className="h-5 w-5" />
          <h4 className="font-semibold">{t("admin.overview.housing.title")}</h4>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={university?.has_dorm ?? false}
              onCheckedChange={(val) => updateUniversity('has_dorm', val)}
            />
            <Label>{t("admin.overview.housing.hasHousing")}</Label>
          </div>
          
          {university?.has_dorm && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>{t("admin.overview.housing.monthlyPrice")}</Label>
                <Input
                  type="number"
                  value={university?.dorm_price_monthly_local ?? ""}
                  onChange={(e) => updateUniversity('dorm_price_monthly_local', e.target.value ? Number(e.target.value) : null)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.overview.housing.currency")}</Label>
                <Input
                  value={university?.dorm_currency_code ?? ""}
                  onChange={(e) => updateUniversity('dorm_currency_code', e.target.value.toUpperCase())}
                  placeholder="USD"
                  className="uppercase"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Institution Rankings Section */}
      <InstitutionRankingPanel universityId={universityId} />
    </div>
  );
}
