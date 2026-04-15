/**
 * ============= Generic Filters Component =============
 * Contract v1: Renders only the allowed filter fields per tab.
 * Now with full 12-language translation support using t() keys.
 */
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, MapPin, GraduationCap, Award, DollarSign, Calendar, ArrowUpDown, BookOpen, Globe } from "lucide-react";
import type { FilterField } from "@/config/searchTabs";
import { EVENTS_TYPE_OPTIONS, SORT_OPTIONS, LANGUAGES_OPTIONS, UNIVERSITY_TYPE_OPTIONS, BOOLEAN_YESNO_OPTIONS } from "@/config/searchTabs";
import { useLookups } from "@/hooks/useLookups";
import { useCountryName } from "@/hooks/useCountryName";
import { useLanguage } from "@/contexts/LanguageContext";

interface GenericFiltersProps {
  fields: FilterField[];
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onSearch: () => void;
}

export function GenericFilters({
  fields,
  filters,
  onFiltersChange,
  onSearch
}: GenericFiltersProps) {
  const { countries, degrees, certs, subjects, disciplines, loading } = useLookups();
  const { getCountryName } = useCountryName();
  const { t } = useLanguage();

  const handleChange = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    const resetFilters: Record<string, any> = {};
    fields.forEach(field => {
      resetFilters[field.key] = null;
    });
    onFiltersChange(resetFilters);
  };

  const getFieldIcon = (field: FilterField) => {
    switch (field.type) {
      case "select:countries": return MapPin;
      case "select:degrees": return GraduationCap;
      case "select:certificates": return Award;
      case "select:subjects": return BookOpen;
      case "select:disciplines": return BookOpen;
      case "select:languages": return Globe;
      case "select:sort_universities": return ArrowUpDown;
      case "select:boolean_yesno": return null;
      case "select:university_type": return null;
      case "number": return DollarSign;
      case "date": return Calendar;
      default: return null;
    }
  };

  // Helper to translate field labels/placeholders (they are now i18n keys)
  const tField = (key?: string) => key ? t(key) : '';

  const renderField = (field: FilterField) => {
    const value = filters[field.key] || '';
    const Icon = getFieldIcon(field);

    switch (field.type) {
      case "select:countries":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {countries.map(c => (
                  <SelectItem key={c.id} value={c.slug}>{getCountryName(c.slug, c.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:degrees":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {degrees.map((d: any) => (
                  <SelectItem key={d.id} value={d.slug || d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:subjects":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:disciplines":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {disciplines.map(d => (
                  <SelectItem key={d.id} value={d.slug}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );


        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {LANGUAGES_OPTIONS.map(lang => (
                  <SelectItem key={lang.id} value={lang.code}>{t(lang.nameKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:certificates":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {certs.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:events_type":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {EVENTS_TYPE_OPTIONS.map(e => (
                  <SelectItem key={e.id} value={e.id}>{t(e.nameKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:sort_universities":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value || 'popularity'}
              onValueChange={(val) => handleChange(field.key, val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                {SORT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:boolean_yesno":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value === true ? 'true' : value === false ? 'false' : (value || '')}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val === 'true')}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {BOOLEAN_YESNO_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "select:university_type":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleChange(field.key, val === 'all' ? null : val)}
            >
              <SelectTrigger id={field.key} className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background">
                <SelectValue placeholder={tField(field.placeholder) || tField(field.label)} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 rounded-xl">
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                {UNIVERSITY_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "number":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Input
              id={field.key}
              type="number"
              placeholder={tField(field.placeholder)}
              value={value || ''}
              onChange={(e) => handleChange(field.key, e.target.value ? Number(e.target.value) : null)}
              className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background"
            />
          </div>
        );

      case "text":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              <Search className="w-3.5 h-3.5 text-primary" />
              {tField(field.label)}
            </Label>
            <Input
              id={field.key}
              type="text"
              placeholder={tField(field.placeholder)}
              value={value || ''}
              onChange={(e) => handleChange(field.key, e.target.value || null)}
              className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background"
            />
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
            <Label htmlFor={field.key} className="text-xs font-bold mb-1.5 flex items-center gap-2 text-foreground/80">
              {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
              {tField(field.label)}
            </Label>
            <Input
              id={field.key}
              type="date"
              value={value || ''}
              onChange={(e) => handleChange(field.key, e.target.value || null)}
              className="h-12 rounded-xl border-2 hover:border-primary/50 transition-all bg-background"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="filters__row flex flex-col lg:flex-row gap-4 items-end flex-wrap">
      {fields.map(field => (
        <div key={field.key} className="flex-1 min-w-[180px]">
          {renderField(field)}
        </div>
      ))}

      <div className="flex gap-3 lg:min-w-[240px] lg:self-end">
        <Button
          onClick={onSearch}
          size="lg"
          className="flex-1 lg:flex-none lg:min-w-[140px] h-12
                     bg-gradient-to-r from-primary via-primary to-accent 
                     hover:shadow-[0_8px_30px_hsl(var(--primary)/0.4)]
                     hover:scale-[1.02] 
                     font-bold text-white rounded-xl
                     transition-all duration-300 
                     shadow-[0_4px_20px_hsl(var(--primary)/0.25)]
                     border-0 relative overflow-hidden
                     before:absolute before:inset-0 
                     before:bg-gradient-to-r before:from-white/0 before:via-white/20 before:to-white/0
                     before:translate-x-[-200%] hover:before:translate-x-[200%]
                     before:transition-transform before:duration-700"
        >
          <Search className="w-5 h-5 ml-2" />
          {t("filter.search")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleReset}
          className="h-12 px-5 rounded-xl
                     border-2 border-border
                     hover:border-destructive hover:bg-destructive/5
                     hover:scale-105 
                     transition-all duration-300 
                     shadow-sm hover:shadow-md
                     group"
          title={t("filter.reset")}
        >
          <X className="w-5 h-5 text-muted-foreground group-hover:text-destructive transition-colors" />
        </Button>
      </div>
    </div>
  );
}
