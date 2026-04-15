import { useState } from 'react';
import type { ParseResult } from '../types';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PreviewTableProps {
  result: ParseResult;
}

const PAGE_SIZE = 20;

export function PreviewTable({ result }: PreviewTableProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [page, setPage] = useState(0);

  const filtered = filter === 'all'
    ? result.rows
    : result.rows.filter(r => r.status === filter);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const displayHeaders = result.headers.slice(0, 6); // show first 6 columns max

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'valid', 'invalid'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setPage(0); }}
          >
            {f === 'all' ? t('admin.import.all') : f === 'valid' ? t('admin.import.validRows') : t('admin.import.invalidRows')}
            <span className="ms-1 text-xs opacity-70">
              ({f === 'all' ? result.rows.length : result.rows.filter(r => r.status === f).length})
            </span>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-20">{t('admin.import.status')}</TableHead>
              {displayHeaders.map(h => (
                <TableHead key={h} className="max-w-[160px]">{h}</TableHead>
              ))}
              {result.headers.length > 6 && (
                <TableHead className="text-muted-foreground">+{result.headers.length - 6}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(row => (
              <TableRow key={row.index} className={row.status === 'invalid' ? 'bg-destructive/5' : ''}>
                <TableCell className="text-xs text-muted-foreground">{row.index}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'valid' ? 'default' : 'destructive'} className="text-[10px]">
                    {row.status}
                  </Badge>
                </TableCell>
                {displayHeaders.map(h => (
                  <TableCell key={h} className="text-xs max-w-[160px] truncate">
                    {row.data[h] || '—'}
                  </TableCell>
                ))}
                {result.headers.length > 6 && <TableCell />}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t('admin.import.page')} {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              ←
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
