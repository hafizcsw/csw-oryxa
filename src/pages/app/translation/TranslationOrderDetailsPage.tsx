import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNotarizedTranslation } from '@/hooks/useNotarizedTranslation';
import { 
  ArrowLeft, ArrowRight, Upload, CheckCircle, XCircle, 
  Clock, Loader2, Download, FileText, AlertTriangle, RefreshCw,
  CreditCard, CheckCircle2
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface Job {
  id: string;
  doc_slot: string;
  status: string;
  quality_score: number | null;
  rejection_code: string | null;
  rejection_reasons: string[] | null;
  fix_tips: string[] | null;
  draft_pdf_path: string | null;
  draft_docx_path: string | null;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  awaiting_upload: Upload,
  awaiting_precheck: Clock,
  precheck_rejected: XCircle,
  awaiting_quote: Clock,
  quote_presented: CheckCircle,
  awaiting_payment: Clock,
  paid: CheckCircle,
  processing_ocr: Loader2,
  processing_extract: Loader2,
  processing_translate: Loader2,
  processing_render: Loader2,
  draft_ready: CheckCircle,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  awaiting_upload: 'bg-yellow-500/10 text-yellow-600',
  awaiting_precheck: 'bg-blue-500/10 text-blue-600',
  precheck_rejected: 'bg-red-500/10 text-red-600',
  awaiting_quote: 'bg-purple-500/10 text-purple-600',
  quote_presented: 'bg-purple-500/10 text-purple-600',
  awaiting_payment: 'bg-yellow-500/10 text-yellow-600',
  paid: 'bg-green-500/10 text-green-600',
  processing_ocr: 'bg-blue-500/10 text-blue-600',
  processing_extract: 'bg-blue-500/10 text-blue-600',
  processing_translate: 'bg-blue-500/10 text-blue-600',
  processing_render: 'bg-blue-500/10 text-blue-600',
  draft_ready: 'bg-green-500/10 text-green-600',
  failed: 'bg-red-500/10 text-red-600',
};

export default function TranslationOrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { t, i18n } = useTranslation('translation');
  const navigate = useNavigate();
  const { getOrderStatus, uploadFile, startProcessing, getDownloadUrl, createQuote, acceptQuote, getQuote, startPayment, simulatePayment, loading } = useNotarizedTranslation();

  const [order, setOrder] = useState<Order | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quote, setQuote] = useState<{
    quote_id: string;
    status: string;
    currency: string;
    total_amount: number;
    breakdown: Array<{
      job_id: string;
      doc_slot: string;
      page_count: number;
      base_fee: number;
      extra_pages: number;
      extra_pages_fee: number;
      complexity_surcharge: number;
      line_total: number;
    }>;
    expires_at: string;
  } | null>(null);
  const [payment, setPayment] = useState<{
    payment_id: string;
    amount_minor: number;
    currency: string;
    provider: string;
    mock_mode?: boolean;
  } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isRTL = i18n.language === 'ar';
  const locale = isRTL ? ar : enUS;
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    setRefreshing(true);
    try {
      const data = await getOrderStatus(orderId);
      setOrder(data.order);
      setJobs(data.jobs);
      
      // Fetch quote if order is in quote state
      if (['awaiting_quote', 'quote_presented', 'awaiting_payment'].includes(data.order.status)) {
        try {
          const quoteData = await getQuote(orderId);
          if (quoteData.ok) {
            setQuote(quoteData);
          }
        } catch {
          // Quote may not exist yet
        }
      }
    } catch {
      // Error handled in hook
    } finally {
      setRefreshing(false);
    }
  }, [orderId, getOrderStatus, getQuote]);

  useEffect(() => {
    fetchStatus();
    // Poll for updates
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleFileUpload = async (jobId: string, file: File) => {
    if (!orderId) return;
    setUploading(jobId);
    try {
      await uploadFile(orderId, jobId, file);
      await fetchStatus();
    } finally {
      setUploading(null);
    }
  };

  const handleStartProcessing = async () => {
    if (!orderId) return;
    try {
      await startProcessing(orderId);
      await fetchStatus();
    } catch {
      // Error handled in hook
    }
  };

  const handleDownload = async (jobId: string, type: 'draft_pdf' | 'draft_docx') => {
    try {
      const url = await getDownloadUrl(jobId, type);
      window.open(url, '_blank');
    } catch {
      // Error handled in hook
    }
  };

  const handleCalculatePrice = async () => {
    if (!orderId) return;
    try {
      const data = await createQuote(orderId);
      setQuote(data);
      await fetchStatus();
    } catch {
      // Error handled in hook
    }
  };

  const handleAcceptQuote = async () => {
    if (!quote?.quote_id) return;
    try {
      await acceptQuote(quote.quote_id);
      // After accepting quote, start payment
      const paymentData = await startPayment(quote.quote_id);
      setPayment(paymentData);
      await fetchStatus();
    } catch {
      // Error handled in hook
    }
  };

  const handleConfirmPayment = async () => {
    if (!payment?.payment_id) return;
    try {
      await simulatePayment(payment.payment_id, 'succeeded');
      setPayment(null);
      await fetchStatus();
    } catch {
      // Error handled in hook
    }
  };

  const allJobsReadyForQuote = jobs.length > 0 && jobs.every(j => 
    j.status === 'awaiting_quote' || j.status === 'awaiting_payment' || j.status === 'paid'
  );

  const allJobsReady = jobs.length > 0 && jobs.every(j => 
    j.status === 'awaiting_payment' || j.status === 'paid'
  );

  const completedJobs = jobs.filter(j => j.status === 'draft_ready').length;
  const progress = jobs.length > 0 ? (completedJobs / jobs.length) * 100 : 0;

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(cents / 100);
  };

  if (!order) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>{t('order.orderDetails')} | CSW</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/app/translation/new')}
              className="mb-2"
            >
              <ArrowIcon className="w-4 h-4 mr-2" />
              {t('actions.back')}
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {t('order.orderDetails')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('order.orderId')}: {orderId?.slice(0, 8)}...
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '...' : t('actions.retry')}
          </Button>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('order.status')}</span>
              <Badge className={STATUS_COLORS[order.status] || 'bg-muted'}>
                {t(`status.${order.status}`)}
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedJobs}/{jobs.length} {t('order.completedDocuments')}
            </p>
          </CardContent>
        </Card>

        {/* Jobs List */}
        <div className="space-y-4 mb-6">
          {jobs.map(job => {
            const StatusIcon = STATUS_ICONS[job.status] || Clock;
            const isProcessing = job.status.startsWith('processing');
            
            return (
              <Card key={job.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {t(`docSlots.${job.doc_slot}`)}
                    </CardTitle>
                    <Badge className={STATUS_COLORS[job.status] || 'bg-muted'}>
                      <StatusIcon className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                      {t(`status.${job.status}`)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Upload state */}
                  {job.status === 'awaiting_upload' && (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('upload.formats')}
                      </p>
                      <label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(job.id, file);
                          }}
                          disabled={uploading === job.id}
                        />
                        <Button asChild disabled={uploading === job.id}>
                          <span>
                            {uploading === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {t('actions.upload')}
                          </span>
                        </Button>
                      </label>
                    </div>
                  )}

                  {/* Rejected state */}
                  {job.status === 'precheck_rejected' && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-700 dark:text-red-400">
                            {job.rejection_code && t(`rejection.${job.rejection_code}`)}
                          </p>
                          {job.fix_tips?.[0] && (
                            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                              {job.fix_tips[0]}
                            </p>
                          )}
                          <label className="mt-3 inline-block">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(job.id, file);
                              }}
                              disabled={uploading === job.id}
                            />
                            <Button variant="outline" size="sm" asChild>
                              <span>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {t('actions.replace')}
                              </span>
                            </Button>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ready for download */}
                  {job.status === 'draft_ready' && (
                    <div className="flex flex-wrap gap-2">
                      {job.draft_pdf_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(job.id, 'draft_pdf')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t('actions.downloadDraftPdf')}
                        </Button>
                      )}
                      {job.draft_docx_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(job.id, 'draft_docx')}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t('actions.downloadDraftDocx')}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Quality score */}
                  {job.quality_score !== null && job.status !== 'precheck_rejected' && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {t('precheck.qualityScore')}: {Math.round(job.quality_score * 100)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Calculate Price Button - when all jobs passed precheck */}
        {allJobsReadyForQuote && order.status === 'awaiting_quote' && !quote && (
          <Card className="bg-purple-500/5 border-purple-500/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t('precheck.passed')}</h3>
                  <p className="text-sm text-muted-foreground">{t('pricing.title')}</p>
                </div>
                <Button onClick={handleCalculatePrice} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('actions.calculatePrice')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Display */}
        {quote && quote.status === 'presented' && (
          <Card className="bg-primary/5 border-primary/20 mb-6">
            <CardHeader>
              <CardTitle>{t('pricing.breakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {quote.breakdown.map((item) => (
                  <div key={item.job_id} className="border-b border-border/50 pb-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>{t(`docSlots.${item.doc_slot}`)}</span>
                      <span>{formatPrice(item.line_total, quote.currency)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      <div className="flex justify-between">
                        <span>{t('pricing.basePrice')}</span>
                        <span>{formatPrice(item.base_fee, quote.currency)}</span>
                      </div>
                      {item.extra_pages > 0 && (
                        <div className="flex justify-between">
                          <span>{t('pricing.extraPages')} ({item.extra_pages})</span>
                          <span>+{formatPrice(item.extra_pages_fee, quote.currency)}</span>
                        </div>
                      )}
                      {item.complexity_surcharge > 0 && (
                        <div className="flex justify-between">
                          <span>{t('pricing.complexitySurcharge')}</span>
                          <span>+{formatPrice(item.complexity_surcharge, quote.currency)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between font-bold text-lg">
                  <span>{t('pricing.total')}</span>
                  <span className="text-primary">{formatPrice(quote.total_amount, quote.currency)}</span>
                </div>
              </div>
              <Button onClick={handleAcceptQuote} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('actions.acceptQuote')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Section - Mock Mode */}
        {(order.status === 'awaiting_payment' || payment) && (
          <Card className="bg-green-500/5 border-green-500/20 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('payment.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('pricing.total')}</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(quote.total_amount, quote.currency)}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('payment.mockModeDescription')}
                </p>
                
                <Button 
                  onClick={handleConfirmPayment} 
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  {t('payment.confirmPayment')}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  {t('payment.mockModeNote')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Start Processing Button */}
        {allJobsReady && order.status === 'paid' && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t('order.documents')} {t('precheck.passed')}</h3>
                  <p className="text-sm text-muted-foreground">{t('actions.startProcessing')}</p>
                </div>
                <Button onClick={handleStartProcessing} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('actions.startProcessing')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t('timeline.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t('timeline.orderCreated')}: {formatDistanceToNow(new Date(order.created_at), { locale, addSuffix: true })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
