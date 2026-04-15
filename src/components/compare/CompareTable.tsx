import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Check, X, HelpCircle } from "lucide-react";
import type { CompareProgramV1Item } from "@/lib/portalApi";
import { useTranslation } from 'react-i18next';

interface CompareTableProps {
  programs: CompareProgramV1Item[];
  missingFields: Record<string, string[]>;
  locale: string;
}

const COMPARE_COLUMNS = [
  { key: 'university_name', labelKey: 'compare.table.columns.university_name' },
  { key: 'program_name', labelKey: 'compare.table.columns.program_name' },
  { key: 'country_name', labelKey: 'compare.table.columns.country_name' },
  { key: 'city', labelKey: 'compare.table.columns.city' },
  { key: 'degree_name', labelKey: 'compare.table.columns.degree_name' },
  { key: 'discipline_name', labelKey: 'compare.table.columns.discipline_name' },
  { key: 'instruction_languages', labelKey: 'compare.table.columns.instruction_languages' },
  { key: 'tuition_usd_year_min', labelKey: 'compare.table.columns.tuition_usd_year_min' },
  { key: 'tuition_usd_year_max', labelKey: 'compare.table.columns.tuition_usd_year_max' },
  { key: 'duration_months', labelKey: 'compare.table.columns.duration_months' },
  { key: 'has_dorm', labelKey: 'compare.table.columns.has_dorm' },
  { key: 'dorm_price_monthly_usd', labelKey: 'compare.table.columns.dorm_price_monthly_usd' },
  { key: 'monthly_living_usd', labelKey: 'compare.table.columns.monthly_living_usd' },
  { key: 'scholarship_available', labelKey: 'compare.table.columns.scholarship_available' },
  { key: 'intake_months', labelKey: 'compare.table.columns.intake_months' },
  { key: 'deadline_date', labelKey: 'compare.table.columns.deadline_date' },
  { key: 'ranking', labelKey: 'compare.table.columns.ranking' },
] as const;

const CRITICAL_FIELDS = ['tuition_usd_year_max', 'duration_months', 'deadline_date', 'dorm_price_monthly_usd', 'monthly_living_usd'];

function formatValue(key: string, value: unknown, locale: string, t: (key: string, options?: Record<string, unknown>) => string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">{t('compare.table.na')}</span>;
  }

  if (key === 'has_dorm' || key === 'scholarship_available') {
    return value ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-muted-foreground" />;
  }

  if (key === 'instruction_languages' && Array.isArray(value)) {
    return value.join(', ') || t('compare.table.notSpecified');
  }

  if (key === 'intake_months' && Array.isArray(value)) {
    const monthNames = Array.from({ length: 12 }, (_, index) => (
      new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, index, 1))
    ));

    return value.map((m: number | string) => {
      const monthIndex = typeof m === 'string' ? parseInt(m) - 1 : m - 1;
      return monthNames[monthIndex] || m;
    }).join(', ') || t('compare.table.notSpecified');
  }

  if (key.includes('usd') || key.includes('price') || key.includes('living')) {
    return `$${Number(value).toLocaleString()}`;
  }

  return String(value);
}

export function CompareTable({ programs, missingFields, locale }: CompareTableProps) {
  const { t, i18n } = useTranslation('common');
  const displayLocale = i18n.resolvedLanguage || locale;

  if (programs.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{t('compare.empty')}</div>;
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-start font-medium sticky start-0 bg-muted/50 z-10">
                {t('compare.table.field')}
              </th>
              {programs.map((program) => {
                const hasMissing = missingFields[program.program_id]?.length > 0;
                const missingList = missingFields[program.program_id] || [];

                return (
                  <th key={program.program_id} className="p-3 text-center font-medium min-w-[200px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold">{program.program_name}</span>
                      <span className="text-xs text-muted-foreground">{program.university_name}</span>
                      {hasMissing && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1 text-destructive border-destructive/50">
                              <AlertTriangle className="h-3 w-3" />
                              {t('compare.table.missingData')}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px]">
                            <p className="font-medium mb-1">{t('compare.table.missingFields')}</p>
                            <ul className="list-disc list-inside text-xs">
                              {missingList.map(field => (
                                <li key={field}>{field}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARE_COLUMNS.map((col) => {
              const isCritical = CRITICAL_FIELDS.includes(col.key);

              return (
                <tr key={col.key} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium sticky start-0 bg-background z-10">
                    <div className="flex items-center gap-1">
                      {t(col.labelKey)}
                      {isCritical && (
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>{t('compare.table.criticalForComparison')}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  {programs.map((program) => {
                    const value = program[col.key as keyof CompareProgramV1Item];
                    const isMissing = missingFields[program.program_id]?.includes(col.key);

                    return (
                      <td key={program.program_id} className={`p-3 text-center ${isMissing ? 'bg-muted/50' : ''}`}>
                        {formatValue(col.key, value, displayLocale, t)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
