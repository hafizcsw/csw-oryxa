import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Loader2, 
  Check, 
  AlertCircle,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  paymentId: string;
  provider: 'mock' | 'stripe';
  amountMinor: number;
  currency: string;
  status: string;
}

interface TranslationPaymentSectionProps {
  quoteReady: boolean;
  quote: { quoteId: string; totalMinor: number; currency: string } | null;
  payment: Payment | null;
  orderStatus: string;
  onAcceptQuote: () => Promise<void>;
  onStartPayment: () => Promise<void>;
  onSimulatePayment: (status: 'succeeded' | 'failed') => Promise<void>;
  onStartProcessing: () => Promise<void>;
  loading?: boolean;
}

export function TranslationPaymentSection({
  quoteReady,
  quote,
  payment,
  orderStatus,
  onAcceptQuote,
  onStartPayment,
  onSimulatePayment,
  onStartProcessing,
  loading = false,
}: TranslationPaymentSectionProps) {
  const { t } = useTranslation('translation');
  const [step, setStep] = useState<'quote' | 'payment' | 'simulate' | 'processing' | 'done'>('quote');

  const formatCurrency = (amountMinor: number, currency: string) => {
    const amount = amountMinor / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  // Determine current step based on state
  const currentStep = (() => {
    if (orderStatus === 'paid' || orderStatus.startsWith('processing')) {
      return 'processing';
    }
    if (payment?.status === 'succeeded') {
      return 'processing';
    }
    if (payment?.status === 'pending') {
      return 'simulate';
    }
    if (quote?.quoteId && orderStatus === 'quoted') {
      return 'payment';
    }
    return 'quote';
  })();

  const handleAcceptAndPay = async () => {
    try {
      setStep('payment');
      await onAcceptQuote();
      await onStartPayment();
      setStep('simulate');
    } catch (error) {
      setStep('quote');
    }
  };

  const handleSimulateSuccess = async () => {
    try {
      setStep('processing');
      await onSimulatePayment('succeeded');
      await onStartProcessing();
      setStep('done');
    } catch (error) {
      setStep('simulate');
    }
  };

  // Not ready for payment
  if (!quoteReady || !quote) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CreditCard className="h-5 w-5 opacity-50" />
            <p>{t('unified.completeDocumentsFirst')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing started
  if (currentStep === 'processing') {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t('unified.paymentComplete')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('unified.processingStarted')}
                </p>
              </div>
            </div>
            <Badge variant="default">
              {t('status.paid')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mock payment simulation step
  if (currentStep === 'simulate') {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">{t('unified.mockPaymentTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('unified.mockPaymentDesc')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSimulateSuccess}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('unified.simulateSuccess')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onSimulatePayment('failed')}
              disabled={loading}
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              {t('unified.simulateFailed')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready to accept quote and pay
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">{t('unified.readyToPay')}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(quote.totalMinor, quote.currency)}
              </p>
            </div>
          </div>

          <Button
            onClick={handleAcceptAndPay}
            disabled={loading}
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {t('unified.proceedToPayment')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
