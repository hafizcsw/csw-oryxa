import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Check, 
  AlertCircle, 
  Upload,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SlotId, SlotUI } from './TranslationDocumentSlot';
import { QualityProgress } from './QualityBadge';

interface TranslationPreviewPanelProps {
  slotId: SlotId | null;
  slot: SlotUI | null;
  onUploadClick: () => void;
  onReplaceClick: () => void;
  loading?: boolean;
}

export function TranslationPreviewPanel({
  slotId,
  slot,
  onUploadClick,
  onReplaceClick,
  loading = false,
}: TranslationPreviewPanelProps) {
  const { t } = useTranslation('translation');

  // Empty state
  if (!slotId || !slot) {
    return (
      <Card className="flex flex-col min-h-[500px]">
        <CardHeader>
          <CardTitle className="text-lg">{t('unified.previewTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>{t('unified.noSelection')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const previewUrl = slot.localPreviewUrl || slot.uploadedPreviewUrl;
  const isPdf = slot.fileName?.toLowerCase().endsWith('.pdf');

  return (
    <Card className="flex flex-col min-h-[500px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {t(`docSlots.${slotId}`)}
          </CardTitle>
          {slot.status === 'ready' && (
            <Badge variant="default" className="bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              {t('unified.readyForPricing')}
            </Badge>
          )}
          {slot.status === 'rejected' && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {t('unified.rejected')}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Preview Area */}
        <div 
          className={cn(
            "relative h-[350px] rounded-lg border-2 border-dashed",
            "flex items-center justify-center overflow-hidden",
            slot.status === 'idle' && "border-muted-foreground/25 bg-muted/30",
            (slot.status === 'uploading' || slot.status === 'checking') && "border-primary/50 bg-primary/5",
            slot.status === 'ready' && "border-green-500/50 bg-green-500/5",
            slot.status === 'rejected' && "border-destructive/50 bg-destructive/5"
          )}
        >
          {previewUrl ? (
            <>
              {isPdf ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[400px]"
                  title={t(`docSlots.${slotId}`)}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={t(`docSlots.${slotId}`)}
                  className="max-w-full max-h-full object-contain"
                />
              )}

              {/* Loading overlay */}
              {(slot.status === 'uploading' || slot.status === 'checking' || loading) && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {slot.status === 'uploading' 
                      ? t('unified.uploadingFile') 
                      : t('unified.runningPrecheck')}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-6">
              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-3">
                {t('unified.dropToUpload')}
              </p>
              <Button 
                variant="outline" 
                onClick={onUploadClick}
                disabled={loading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('unified.selectFile')}
              </Button>
            </div>
          )}
        </div>

        {/* Precheck Results */}
        {slot.precheck && (
          <Card className={cn(
            "border-2",
            slot.status === 'ready' && "border-green-500/50 bg-green-500/5",
            slot.status === 'rejected' && "border-destructive/50 bg-destructive/5"
          )}>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                {slot.status === 'ready' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                {t('unified.processingStatus')}
              </h4>

              <div className="space-y-4 text-sm">
                {slot.precheck.pages !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('unified.pagesDetected')}</span>
                    <span className="font-medium">{slot.precheck.pages}</span>
                  </div>
                )}
                
                {slot.precheck.score !== undefined && (
                  <QualityProgress 
                    score={slot.precheck.score} 
                    showDescription={true} 
                  />
                )}
              </div>

              {slot.status === 'rejected' && (
                <div className="mt-3 pt-3 border-t">
                  {slot.precheck.rejectionCode && (
                    <p className="text-sm text-destructive mb-2">
                      {t(`rejection.${slot.precheck.rejectionCode}`)}
                    </p>
                  )}
                  {slot.precheck.fixTips && slot.precheck.fixTips.length > 0 && (
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      {slot.precheck.fixTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={onReplaceClick}
                    disabled={loading}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    {t('unified.replaceFile')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Replace button for ready state */}
        {slot.status === 'ready' && previewUrl && (
          <Button 
            variant="outline" 
            onClick={onReplaceClick}
            disabled={loading}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('unified.replaceFile')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
