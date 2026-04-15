import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Receipt } from 'lucide-react';
import type { SlotId } from './TranslationDocumentSlot';

interface QuoteBreakdownItem {
  docSlot: SlotId;
  pages: number;
  amount: number;
  currency: string;
}

interface Quote {
  quoteId: string;
  totalMinor: number;
  currency: string;
  breakdown: QuoteBreakdownItem[];
  status: string;
}

interface TranslationQuoteLiveProps {
  quote: Quote | null;
  readyCount: number;
  totalCount: number;
  loading?: boolean;
}

export function TranslationQuoteLive({
  quote,
  readyCount,
  totalCount,
  loading = false,
}: TranslationQuoteLiveProps) {
  const { t } = useTranslation('translation');

  const formatCurrency = (amountMinor: number, currency: string) => {
    const amount = amountMinor / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  // No ready documents
  if (readyCount === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Receipt className="h-5 w-5" />
            <p>{t('unified.uploadFirst')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading quote
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('unified.calculatingQuote')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quote ready
  if (quote) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('unified.quoteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Breakdown */}
          <div className="space-y-2">
            {quote.breakdown.map((item) => (
              <div 
                key={item.docSlot} 
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {t(`docSlots.${item.docSlot}`)} 
                  <span className="ml-1">
                    ({t('unified.pages', { count: item.pages })})
                  </span>
                </span>
                <span className="font-medium">
                  {formatCurrency(item.amount, item.currency)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t('unified.total')}</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(quote.totalMinor, quote.currency)}
            </span>
          </div>

          {/* Status */}
          <p className="text-xs text-muted-foreground text-center">
            {readyCount < totalCount 
              ? t('unified.partialQuote', { ready: readyCount, total: totalCount })
              : t('unified.allReady')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Waiting for quote calculation
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Receipt className="h-5 w-5" />
          <p>
            {t('unified.documentsReady', { count: readyCount })}
            {readyCount < totalCount && (
              <span className="ml-1">
                ({t('unified.moreToUpload', { count: totalCount - readyCount })})
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
