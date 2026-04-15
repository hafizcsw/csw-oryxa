import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GitCompare, MessageSquare, AlertTriangle, Trash2, X } from "lucide-react";
import { useComparePrograms } from "@/hooks/useComparePrograms";
import { CompareTable } from "./CompareTable";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { buildCompareRequestPayload, queueCompareRequestPayload } from "@/lib/portalApi";

interface CompareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompareDrawer({ open, onOpenChange }: CompareDrawerProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openChat, isOpen: isChatOpen } = useMalakChat();
  const {
    compareList,
    count,
    removeFromCompare,
    clearCompare,
    canCompare,
    maxCompare,
    comparisonData,
    missingFields,
    notFoundIds,
    isLoading,
    error,
    fetchComparison,
    clearComparisonData,
  } = useComparePrograms();
  const [hasFetched, setHasFetched] = useState(false);

  const handleFetchComparison = useCallback(async () => {
    setHasFetched(true);

    const result = await fetchComparison({ locale: language, audience: 'customer' });

    if (result?.not_found_ids?.length) {
      toast({
        title: t('compare.drawer.programsExcludedTitle'),
        description: t('compare.drawer.programsExcludedDescription', { count: result.not_found_ids.length }),
        variant: 'destructive',
      });
    }
  }, [fetchComparison, language, t, toast]);

  useEffect(() => {
    if (open && canCompare && !hasFetched) {
      void handleFetchComparison();
    }
  }, [open, canCompare, hasFetched, handleFetchComparison]);

  useEffect(() => {
    if (!open) {
      setHasFetched(false);
      clearComparisonData();
    }
  }, [clearComparisonData, open]);

  const handleAskBot = useCallback(() => {
    if (!canCompare) {
      toast({
        title: t('compare.drawer.minimumTitle'),
        description: t('compare.drawer.minimumDescription'),
        variant: 'destructive',
      });
      return;
    }

    const compareEvent = buildCompareRequestPayload({
      programIds: compareList,
      locale: language,
      message: t('compare.chat.requestMessage'),
      audience: 'customer',
    });

    console.log('[COMPARE:UI] compare_request_v1 queued:', compareEvent);

    onOpenChange(false);
    if (!isChatOpen) {
      openChat();
    }

    queueCompareRequestPayload(compareEvent);

    toast({
      title: t('compare.drawer.comparingTitle'),
      description: t('compare.drawer.comparingDescription'),
    });
  }, [compareList, canCompare, isChatOpen, language, onOpenChange, openChat, t, toast]);

  const handleClear = () => {
    clearCompare();
    clearComparisonData();
    setHasFetched(false);
    onOpenChange(false);
  };

  const handleOpenComparePage = () => {
    navigate(`/compare?ids=${compareList.join(',')}`, { replace: false });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              <SheetTitle>{t('compare.drawer.title')}</SheetTitle>
              <Badge variant="secondary">{count}/{maxCompare}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {comparisonData && comparisonData.length >= 2 && (
                <Button variant="default" size="sm" onClick={handleAskBot} className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('compare.drawer.askBot')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
                <Trash2 className="h-4 w-4" />
                {t('compare.drawer.clearAll')}
              </Button>
            </div>
          </div>
          <SheetDescription>{t('compare.drawer.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto mt-4 space-y-4">
          {!canCompare && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('compare.drawer.minimumInline', { count: compareList.length })}
              </AlertDescription>
            </Alert>
          )}

          {notFoundIds.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('compare.drawer.programsExcludedDescription', { count: notFoundIds.length })}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ms-2 text-muted-foreground">{t('compare.drawer.loading')}</span>
            </div>
          )}

          {!isLoading && comparisonData && comparisonData.length > 0 && (
            <CompareTable programs={comparisonData} missingFields={missingFields} locale={language} />
          )}

          {!isLoading && hasFetched && (!comparisonData || comparisonData.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              {t('compare.drawer.noValidPrograms')}
            </div>
          )}

          {!hasFetched && compareList.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">{t('compare.drawer.selectedPrograms')}</p>
              {compareList.map((id) => (
                <div key={id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <code className="text-xs">{id.slice(0, 8)}...{id.slice(-8)}</code>
                  <Button variant="ghost" size="icon" onClick={() => removeFromCompare(id)} aria-label={t('compare.remove')}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t pt-4 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handleOpenComparePage} disabled={!canCompare}>
            {t('compare.page.openPage')}
          </Button>
          <Button onClick={handleFetchComparison} disabled={!canCompare || isLoading} className="gap-2">
            <GitCompare className="h-4 w-4" />
            {t('compare.drawer.compareNow')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
