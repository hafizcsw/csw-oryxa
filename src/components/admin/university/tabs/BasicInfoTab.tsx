import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UniversityData {
  id?: string;
  name: string;
  name_en?: string;
  slug?: string;
  country_id?: string;
  city?: string;
  website?: string;
  ranking?: number | null;
  description?: string;
  tuition_min?: number | null;
  tuition_max?: number | null;
  monthly_living?: number | null;
  is_active?: boolean;
  show_in_home?: boolean;
  display_order?: number | null;
  has_dorm?: boolean;
  dorm_price_monthly_local?: number | null;
  dorm_currency_code?: string | null;
}

interface BasicInfoTabProps {
  data: UniversityData;
  onChange: (data: UniversityData) => void;
  isNew?: boolean;
}

export function BasicInfoTab({ data, onChange, isNew }: BasicInfoTabProps) {
  const { t } = useLanguage();
  const [countries, setCountries] = useState<{ id: string; name_ar: string }[]>([]);

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    const { data: countriesData } = await supabase
      .from("countries")
      .select("id, name_ar")
      .order("display_order", { ascending: true });
    if (countriesData) setCountries(countriesData);
  };

  const updateField = <K extends keyof UniversityData>(
    field: K,
    value: UniversityData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2">{t("basicInfoTab.basicInfo")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("basicInfoTab.universityNameAr")}</Label>
            <Input
              id="name"
              value={data.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder={t("basicInfoTab.universityNameArPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_en">{t("basicInfoTab.universityNameEn")}</Label>
            <Input
              id="name_en"
              value={data.name_en || ""}
              onChange={(e) => updateField("name_en", e.target.value)}
              placeholder={t("basicInfoTab.universityNameEnPlaceholder")}
              dir="ltr"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="country">{t("basicInfoTab.country")}</Label>
            <Select
              value={data.country_id || ""}
              onValueChange={(val) => updateField("country_id", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("basicInfoTab.selectCountry")} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t("basicInfoTab.city")}</Label>
            <Input
              id="city"
              value={data.city || ""}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder={t("basicInfoTab.cityPlaceholder")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t("basicInfoTab.slug")}</Label>
          <Input
            id="slug"
            value={data.slug || ""}
            onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder={t("basicInfoTab.slugPlaceholder")}
            dir="ltr"
          />
        </div>
      </div>

      {/* Links */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2">{t("basicInfoTab.links")}</h4>
        <div className="space-y-2">
          <Label htmlFor="website">{t("basicInfoTab.website")}</Label>
          <Input
            id="website"
            value={data.website || ""}
            onChange={(e) => updateField("website", e.target.value)}
            placeholder={t("basicInfoTab.websitePlaceholder")}
            type="url"
            dir="ltr"
          />
        </div>
      </div>

      {/* Financial Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2">{t("basicInfoTab.financialInfo")}</h4>
        <p className="text-sm text-muted-foreground">
          {t("basicInfoTab.financialInfoNote")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tuition_min">{t("basicInfoTab.tuitionMin")}</Label>
            <Input
              id="tuition_min"
              type="number"
              value={data.tuition_min ?? ""}
              onChange={(e) => updateField("tuition_min", e.target.value ? Number(e.target.value) : null)}
              placeholder={t("basicInfoTab.tuitionMinPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tuition_max">{t("basicInfoTab.tuitionMax")}</Label>
            <Input
              id="tuition_max"
              type="number"
              value={data.tuition_max ?? ""}
              onChange={(e) => updateField("tuition_max", e.target.value ? Number(e.target.value) : null)}
              placeholder={t("basicInfoTab.tuitionMaxPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthly_living" className="flex items-center gap-2">
              {t("basicInfoTab.monthlyLiving")}
              <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {t("basicInfoTab.usdOnly")}
              </span>
            </Label>
            <Input
              id="monthly_living"
              type="number"
              min="0"
              value={data.monthly_living ?? ""}
              onChange={(e) => updateField("monthly_living", e.target.value ? Number(e.target.value) : null)}
              placeholder={t("basicInfoTab.monthlyLivingPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("basicInfoTab.monthlyLivingWarning")}
            </p>
          </div>
        </div>
      </div>

      {/* University Housing */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2 flex items-center gap-2">
          <Home className="h-4 w-4" />
          {t("basicInfoTab.universityHousing")}
        </h4>
        
        <div className="flex items-center gap-3">
          <Switch
            id="has_dorm"
            checked={data.has_dorm ?? false}
            onCheckedChange={(val) => updateField("has_dorm", val)}
          />
          <Label htmlFor="has_dorm">{t("basicInfoTab.hasDorm")}</Label>
        </div>
        
        {data.has_dorm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="dorm_price">{t("basicInfoTab.dormPrice")}</Label>
              <Input
                id="dorm_price"
                type="number"
                min="0"
                value={data.dorm_price_monthly_local ?? ""}
                onChange={(e) => updateField("dorm_price_monthly_local", e.target.value ? Number(e.target.value) : null)}
                placeholder={t("basicInfoTab.dormPricePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dorm_currency">{t("basicInfoTab.dormCurrency")}</Label>
              <Input
                id="dorm_currency"
                value={data.dorm_currency_code ?? ""}
                onChange={(e) => updateField("dorm_currency_code", e.target.value.toUpperCase())}
                placeholder="USD"
                className="uppercase"
                maxLength={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2">{t("basicInfoTab.additionalInfo")}</h4>
        <div className="space-y-2">
          <Label htmlFor="ranking">{t("basicInfoTab.worldRanking")}</Label>
          <Input
            id="ranking"
            type="number"
            value={data.ranking ?? ""}
            onChange={(e) => updateField("ranking", e.target.value ? Number(e.target.value) : null)}
            placeholder={t("basicInfoTab.worldRankingPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("basicInfoTab.description")}</Label>
          <Textarea
            id="description"
            value={data.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder={t("basicInfoTab.descriptionPlaceholder")}
            rows={4}
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-4">
        <h4 className="font-medium text-base border-b pb-2">{t("basicInfoTab.status")}</h4>
        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={data.is_active ?? true}
            onCheckedChange={(val) => updateField("is_active", val)}
          />
          <Label htmlFor="is_active">{t("basicInfoTab.isActive")}</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("basicInfoTab.inactiveNote")}
        </p>
      </div>
    </div>
  );
}
