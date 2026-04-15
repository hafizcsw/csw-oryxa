import { useImportHistory } from '../hooks/useImportHistory';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  applied: 'default',
  partial: 'secondary',
  failed: 'destructive',
  pending: 'outline',
};

export function ImportHistory() {
  const { logs, loading, refresh } = useImportHistory();
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('admin.import.history')}</h3>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('admin.import.noHistory')}
        </p>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.import.filename')}</TableHead>
                <TableHead>{t('admin.import.entityType')}</TableHead>
                <TableHead>{t('admin.import.status')}</TableHead>
                <TableHead>{t('admin.import.totalRows')}</TableHead>
                <TableHead>{t('admin.import.applied')}</TableHead>
                <TableHead>{t('admin.import.failed')}</TableHead>
                <TableHead>{t('admin.import.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-mono max-w-[200px] truncate">
                    {log.filename}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{log.entity_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[log.status] || 'outline'} className="text-[10px]">
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.total_rows}</TableCell>
                  <TableCell className="text-sm text-success">{log.applied_rows}</TableCell>
                  <TableCell className="text-sm text-destructive">
                    {log.total_rows - log.applied_rows - log.skipped_rows}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
