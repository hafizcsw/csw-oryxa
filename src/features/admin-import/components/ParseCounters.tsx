import type { ParseResult } from '../types';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react';

interface ParseCountersProps {
  result: ParseResult;
}

export function ParseCounters({ result }: ParseCountersProps) {
  const { t } = useLanguage();

  const counters = [
    { label: t('admin.import.totalRows'), value: result.totalRows, icon: FileText, color: 'text-foreground' },
    { label: t('admin.import.validRows'), value: result.validRows, icon: CheckCircle, color: 'text-success' },
    { label: t('admin.import.invalidRows'), value: result.invalidRows, icon: XCircle, color: 'text-destructive' },
    { label: t('admin.import.skippedRows'), value: result.skippedRows, icon: AlertTriangle, color: 'text-warning' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {counters.map((c) => (
        <div key={c.label} className="bg-card border rounded-lg p-3 flex items-center gap-3">
          <c.icon className={`h-5 w-5 flex-shrink-0 ${c.color}`} />
          <div>
            <p className="text-xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
