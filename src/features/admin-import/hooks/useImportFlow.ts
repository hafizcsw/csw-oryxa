/**
 * useImportFlow – orchestrates file upload → parse → preview → apply → report
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EntityType, ParseResult, ApplyResult } from '../types';
import { parseCSV } from '../utils/csv-parser';
import { applyImport } from '../utils/apply-import';

export type ImportStage = 'idle' | 'parsed' | 'applying' | 'done' | 'error';

export function useImportFlow() {
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('university');
  const [stage, setStage] = useState<ImportStage>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setStage('idle');
    setParseResult(null);
    setApplyResult(null);
    setLogId(null);
    setError(null);
  }, []);

  const handleFileSelect = useCallback((f: File | null) => {
    setFile(f);
    setStage('idle');
    setParseResult(null);
    setApplyResult(null);
    setLogId(null);
    setError(null);
  }, []);

  const handleParse = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const result = parseCSV(text, entityType);

      if (result.totalRows === 0) {
        setError('No data rows found in file');
        setLoading(false);
        return;
      }

      setParseResult(result);
      setStage('parsed');

      // Create import log entry
      const { data: logData, error: logError } = await supabase
        .from('import_logs')
        .insert({
          filename: file.name,
          import_type: 'csv',
          entity_type: entityType,
          status: 'pending',
          total_rows: result.totalRows,
          valid_rows: result.validRows,
          invalid_rows: result.invalidRows,
          skipped_rows: result.skippedRows,
        })
        .select('id')
        .single();

      if (logError) throw logError;
      setLogId(logData.id);
    } catch (e: any) {
      setError(e.message || 'Parse failed');
      setStage('error');
    } finally {
      setLoading(false);
    }
  }, [file, entityType]);

  const handleApply = useCallback(async () => {
    if (!parseResult || !logId) return;
    setLoading(true);
    setStage('applying');
    setError(null);

    try {
      const result = await applyImport(entityType, parseResult.rows, logId);
      setApplyResult(result);
      setStage('done');
    } catch (e: any) {
      setError(e.message || 'Apply failed');
      setStage('error');
    } finally {
      setLoading(false);
    }
  }, [parseResult, logId, entityType]);

  return {
    file, entityType, stage, parseResult, applyResult, logId, loading, error,
    setEntityType, handleFileSelect, handleParse, handleApply, reset,
  };
}
