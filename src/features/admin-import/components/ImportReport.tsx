import type { ApplyResult, ParseResult } from '../types';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ImportReportProps {
  parseResult: ParseResult;
  applyResult: ApplyResult;
}

export function ImportReport({ parseResult, applyResult }: ImportReportProps) {
  const { t } = useLanguage();
  const allSuccess = applyResult.failed === 0 && applyResult.applied > 0;

  return (
    <Card className={allSuccess ? 'border-success/50' : 'border-warning/50'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {allSuccess ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertCircle className="h-5 w-5 text-warning" />
          )}
          {t('admin.import.report')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t('admin.import.totalRows')}</p>
            <p className="text-lg font-bold">{parseResult.totalRows}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('admin.import.validRows')}</p>
            <p className="text-lg font-bold text-success">{parseResult.validRows}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('admin.import.applied')}</p>
            <p className="text-lg font-bold text-primary">{applyResult.applied}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('admin.import.failed')}</p>
            <p className="text-lg font-bold text-destructive">{applyResult.failed}</p>
          </div>
        </div>

        {applyResult.errors.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1 max-h-[200px] overflow-auto">
            <p className="text-sm font-medium text-destructive flex items-center gap-1">
              <XCircle className="h-4 w-4" /> {t('admin.import.errors')}
            </p>
            {applyResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                Row {e.row}: {e.error}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
