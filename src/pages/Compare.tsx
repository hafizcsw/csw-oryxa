import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, GitCompare, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useComparePrograms } from "@/hooks/useComparePrograms";
import { CompareTable } from "@/components/compare/CompareTable";
import { buildCompareRequestPayload, queueCompareRequestPayload } from "@/lib/portalApi";
import { useMalakChat } from "@/contexts/MalakChatContext";

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { openChat, isOpen: isChatOpen } = useMalakChat();
  const {
    compareList,
    replaceCompare,
    removeFromCompare,
    clearCompare,
    canCompare,
    comparisonData,
    missingFields,
    notFoundIds,
    isLoading,
    error,
    fetchComparison,
    clearComparisonData,
  } = useComparePrograms();
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  const incomingIds = useMemo(
    () => (searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean),
    [searchParams]
  );

  useEffect(() => {
    if (initializedFromUrl) return;
    if (incomingIds.length > 0) {
      replaceCompare(incomingIds);
    }
    setInitializedFromUrl(true);
  }, [incomingIds, initializedFromUrl, replaceCompare]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    const currentIds = compareList.join(',');
    const urlIds = incomingIds.join(',');
    if (currentIds === urlIds) return;

    const nextParams = new URLSearchParams(searchParams);
    if (compareList.length > 0) {
      nextParams.set('ids', currentIds);
    } else {
      nextParams.delete('ids');
    }
    setSearchParams(nextParams, { replace: true });
  }, [compareList, incomingIds, initializedFromUrl, searchParams, setSearchParams]);

  const loadComparison = useCallback(async () => {
    if (!canCompare) return;
    await fetchComparison({ locale: language, audience: 'customer' });
  }, [canCompare, fetchComparison, language]);

  useEffect(() => {
    if (!initializedFromUrl) return;
    if (!canCompare) {
      clearComparisonData();
      return;
    }
    void loadComparison();
  }, [canCompare, clearComparisonData, initializedFromUrl, loadComparison]);

  const handleAskBot = useCallback(() => {
    if (!canCompare) {
      toast({
        title: t('compare.drawer.minimumTitle'),
        description: t('compare.drawer.minimumDescription'),
        variant: 'destructive',
      });
      return;
    }

    const payload = buildCompareRequestPayload({
      programIds: compareList,
      locale: language,
      message: t('compare.chat.requestMessage'),
      audience: 'customer',
    });

    console.log('[COMPARE:UI] compare_request_v1 queued:', payload);
    if (!isChatOpen) {
      openChat();
    }
    queueCompareRequestPayload(payload);

    toast({
      title: t('compare.drawer.comparingTitle'),
      description: t('compare.drawer.comparingDescription'),
    });
  }, [compareList, canCompare, isChatOpen, language, openChat, t, toast]);

  const handleExport = () => {
    toast({
      title: t('compare.page.exportSoonTitle'),
      description: t('compare.page.exportSoonDescription'),
    });
  };

  const handleClear = () => {
    clearCompare();
    clearComparisonData();
  };

  const title = t('compare.page.title');

  return (
    <Layout>
      <section className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="me-2" size={20} />
            {t('compare.back')}
          </Button>

          <div className="flex items-center gap-3">
            <GitCompare className="h-6 w-6" />
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
            <Badge variant="secondary">{compareList.length}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleAskBot} disabled={!canCompare || isLoading}>
              <MessageSquare className="me-2 h-4 w-4" />
              {t('compare.drawer.askBot')}
            </Button>
            <Button onClick={handleExport} variant="outline" disabled={!canCompare}>
              <Download className="me-2" size={20} />
              {t('compare.export')}
            </Button>
            <Button onClick={handleClear} variant="outline" disabled={compareList.length === 0}>
              <Trash2 className="me-2 h-4 w-4" />
              {t('compare.drawer.clearAll')}
            </Button>
          </div>
        </div>

        {!canCompare && (
          <Alert>
            <AlertDescription>{t('compare.drawer.minimumInline', { count: compareList.length })}</AlertDescription>
          </Alert>
        )}

        {notFoundIds.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {t('compare.drawer.programsExcludedDescription', { count: notFoundIds.length })}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {compareList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {compareList.map((id) => (
              <Badge key={id} variant="outline" className="gap-2 px-3 py-1">
                <code className="text-xs">{id.slice(0, 8)}...{id.slice(-4)}</code>
                <button onClick={() => removeFromCompare(id)} aria-label={t('compare.remove')}>
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin me-2" />
            {t('compare.drawer.loading')}
          </div>
        ) : comparisonData && comparisonData.length > 0 ? (
          <CompareTable programs={comparisonData} missingFields={missingFields} locale={language} />
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            {t('compare.empty')}
          </div>
        )}
      </section>
    </Layout>
  );
}
