import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function TeacherFilters() {
  const { t } = useLanguage();

  const FilterSelect = ({ label, defaultVal }: { label: string; defaultVal: string }) => (
    <div className="relative">
      <label className="text-[10px] font-medium text-muted-foreground absolute -top-2 start-3 bg-background px-1 z-10">
        {label}
      </label>
      <select className="appearance-none bg-background border border-border rounded-lg px-3 py-2.5 pe-8 text-sm text-foreground focus:border-primary focus:outline-none transition-colors cursor-pointer w-full min-w-[140px]">
        <option>{defaultVal}</option>
      </select>
      <ChevronDown className="absolute end-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );

  const FilterChip = ({ label }: { label: string }) => (
    <button className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
      {label}
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Top row — main filters */}
      <div className="flex flex-wrap gap-3">
        <FilterSelect label={t("languages.teachers.filterLanguage")} defaultVal={t("languages.teachers.teaches")} />
        <FilterSelect label={t("languages.teachers.filterPrice")} defaultVal="3–150+ USD" />
        <FilterSelect label={t("languages.teachers.filterCountry")} defaultVal={t("languages.teachers.filterCountryAny")} />
        <FilterSelect label={t("languages.teachers.filterAvailability")} defaultVal={t("languages.teachers.filterAvailabilitySelect")} />
      </div>

      {/* Bottom row — chip filters + search */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label={t("languages.teachers.filterSpecialties")} />
        <FilterChip label={t("languages.teachers.filterSpeaks")} />
        <FilterChip label={t("languages.teachers.filterNative")} />
        <FilterChip label={t("languages.teachers.filterCategories")} />

        <div className="ms-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {t("languages.teachers.filterSort")}
          </span>
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("languages.teachers.filterSearch")}
              className="ps-8 pe-3 py-1.5 border border-border rounded-lg text-xs bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none w-48 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
