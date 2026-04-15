import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, Receipt, Sparkles, GraduationCap, Home, Baby, Award, Stethoscope } from 'lucide-react';
import { AIIcon } from '@/components/icons/AIIcon';
import type { SlotId } from './TranslationDocumentSlot';

interface EnhancedLineItem {
  doc_slot: SlotId;
  page_count: number;
  base_fee: number;
  extra_pages_fee: number;
  extra_pages?: number;
  line_total: number;
  currency: string;
}

interface EnhancedQuote {
  quoteId: string;
  subtotalMinor?: number;  // ✅ NEW: Subtotal before VAT
  vatMinor?: number;       // ✅ NEW: VAT amount
  vatRate?: number;        // ✅ NEW: VAT rate (e.g., 0.05 = 5%)
  totalMinor: number;
  currency: string;
  lineItems: EnhancedLineItem[];
  status: string;
}

interface TranslationQuoteEnhancedProps {
  quote: EnhancedQuote | null;
  readyCount: number;
  totalCount: number;
  loading?: boolean;
  onProceedToPayment?: () => void;
  paymentReady?: boolean;
}

const slotIcons: Record<SlotId, React.ReactNode> = {
  passport: <FileText className="h-5 w-5" />,
  certificate: <Award className="h-5 w-5" />,
  transcript: <GraduationCap className="h-5 w-5" />,
  residence: <Home className="h-5 w-5" />,
  birth_certificate: <Baby className="h-5 w-5" />,
  diploma: <GraduationCap className="h-5 w-5" />,
  medical: <Stethoscope className="h-5 w-5" />,
};

export function TranslationQuoteEnhanced({
  quote,
  readyCount,
  totalCount,
  loading = false,
  onProceedToPayment,
  paymentReady = false,
}: TranslationQuoteEnhancedProps) {
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
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="p-6">
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
      <Card className="overflow-hidden">
        <div className="bg-gradient-ai-quote p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
            <p className="text-primary-foreground font-medium">{t('unified.calculatingQuote')}</p>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Quote ready
  if (quote && quote.lineItems.length > 0) {
    return (
      <Card className="overflow-hidden quote-card-glow">
        {/* AI-themed Header */}
        <div className="bg-gradient-ai-quote p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <AIIcon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg text-primary-foreground flex items-center gap-2">
                {t('unified.aiQuoteTitle')}
                <Sparkles className="h-4 w-4 text-warning" />
              </CardTitle>
              <p className="text-primary-foreground/80 text-xs mt-0.5">{t('unified.aiAnalyzed')}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Document Line Items */}
          <AnimatePresence mode="popLayout">
            {quote.lineItems.map((item, index) => (
              <motion.div
                key={item.doc_slot}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.1,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="quote-item-card rounded-xl border border-border/50 p-4 bg-card hover:border-primary/30 transition-colors"
              >
                {/* Document Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {slotIcons[item.doc_slot] || <FileText className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">
                      {t(`docSlots.${item.doc_slot}`)}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {t('unified.pages', { count: item.page_count })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(item.line_total, item.currency)}
                    </span>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 pt-3 border-t border-border/30">
                  {/* Base Fee */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                      {t('unified.baseFee')}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(item.base_fee, item.currency)}
                    </span>
                  </div>

                  {/* Extra Pages */}
                  {item.extra_pages_fee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-info/60" />
                        {t('unified.extraPagesFee')} ({(item.extra_pages ?? item.page_count - 1)}×)
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(item.extra_pages_fee, item.currency)}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <Separator className="my-4" />

          {/* Subtotal + VAT + Total Section */}
          <div className="space-y-3">
            {/* Subtotal */}
            {quote.subtotalMinor !== undefined && quote.subtotalMinor > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('unified.subtotal')}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(quote.subtotalMinor, quote.currency)}
                </span>
              </div>
            )}

            {/* VAT */}
            {quote.vatMinor !== undefined && quote.vatMinor > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('unified.vat')} ({((quote.vatRate ?? 0.05) * 100).toFixed(0)}%)
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(quote.vatMinor, quote.currency)}
                </span>
              </div>
            )}

            {/* Grand Total */}
            <motion.div 
              className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{t('unified.grandTotal')}</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(quote.totalMinor, quote.currency)}
              </span>
            </motion.div>
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

  // Waiting for quote calculation (documents ready but no quote yet)
  return (
    <Card className="border-dashed border-2 border-primary/30">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t('unified.documentsReady', { count: readyCount })}
            </p>
            {readyCount < totalCount && (
              <p className="text-sm">
                {t('unified.moreToUpload', { count: totalCount - readyCount })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
