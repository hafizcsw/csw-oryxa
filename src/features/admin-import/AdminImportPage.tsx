/**
 * Admin Import Page – Upload → Parse → Preview → Apply → Report → History
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useImportFlow } from './hooks/useImportFlow';
import { FileUploader } from './components/FileUploader';
import { ParseCounters } from './components/ParseCounters';
import { PreviewTable } from './components/PreviewTable';
import { ImportReport } from './components/ImportReport';
import { ImportHistory } from './components/ImportHistory';
import { EXPECTED_HEADERS } from './types';
import type { EntityType } from './types';
import { Upload, Eye, Play, RotateCcw } from 'lucide-react';

export function AdminImportPage() {
  const { t } = useLanguage();
  const {
    file, entityType, stage, parseResult, applyResult, loading, error,
    setEntityType, handleFileSelect, handleParse, handleApply, reset,
  } = useImportFlow();

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">{t('admin.import.title')}</h1>

      {/* Step 1: Configure & Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t('admin.import.uploadSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('admin.import.entityType')}</label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as EntityType)}
              disabled={stage !== 'idle'}
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="university">{t('admin.import.university')}</SelectItem>
                <SelectItem value="program">{t('admin.import.program')}</SelectItem>
                <SelectItem value="scholarship">{t('admin.import.scholarship')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FileUploader
            file={file}
            onFileSelect={handleFileSelect}
            disabled={stage !== 'idle'}
          />

          {/* Expected format hint */}
          <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium">{t('admin.import.expectedFormat')}</p>
            <code className="block text-muted-foreground break-all">
              {EXPECTED_HEADERS[entityType].join(', ')}
            </code>
          </div>

          {/* Parse button */}
          {stage === 'idle' && file && (
            <Button onClick={handleParse} disabled={loading} className="w-full sm:w-auto">
              <Eye className="h-4 w-4 me-2" />
              {loading ? t('admin.import.parsing') : t('admin.import.parsePreview')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 2: Preview */}
      {parseResult && stage === 'parsed' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('admin.import.preview')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParseCounters result={parseResult} />
            <PreviewTable result={parseResult} />

            <div className="flex gap-3">
              <Button
                onClick={handleApply}
                disabled={loading || parseResult.validRows === 0}
                className="flex-1 sm:flex-none"
              >
                <Play className="h-4 w-4 me-2" />
                {t('admin.import.applyImport')} ({parseResult.validRows} {t('admin.import.rows')})
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 me-2" />
                {t('admin.import.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Applying */}
      {stage === 'applying' && (
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-3">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{t('admin.import.applying')}</span>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Report */}
      {stage === 'done' && applyResult && parseResult && (
        <div className="space-y-4">
          <ImportReport parseResult={parseResult} applyResult={applyResult} />
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 me-2" />
            {t('admin.import.newImport')}
          </Button>
        </div>
      )}

      {/* Import History */}
      <Card>
        <CardContent className="pt-6">
          <ImportHistory />
        </CardContent>
      </Card>
    </div>
  );
}
