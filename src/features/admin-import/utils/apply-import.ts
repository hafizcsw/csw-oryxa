/**
 * Apply Import – inserts valid rows to ingestions_pending in batches
 */
import { supabase } from '@/integrations/supabase/client';
import type { EntityType, ParsedRow, ApplyResult } from '../types';

const BATCH_SIZE = 200;

export async function applyImport(
  entityType: EntityType,
  rows: ParsedRow[],
  logId: string,
): Promise<ApplyResult> {
  const validRows = rows.filter(r => r.status === 'valid');
  const payloads = validRows.map(r => ({
    type: entityType,
    source: 'csv',
    confidence: 0.9,
    payload: r.data,
  }));

  let applied = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ingestions_pending').insert(batch);

    if (error) {
      // Mark the batch rows as failed
      const batchStart = i;
      const batchEnd = Math.min(i + BATCH_SIZE, payloads.length);
      for (let j = batchStart; j < batchEnd; j++) {
        errors.push({ row: validRows[j].index, error: error.message });
      }
    } else {
      applied += batch.length;
    }
  }

  // Update import log
  const status = errors.length === 0 ? 'applied' : applied > 0 ? 'partial' : 'failed';
  await supabase
    .from('import_logs')
    .update({
      status,
      applied_rows: applied,
      error_details: errors,
      applied_at: new Date().toISOString(),
    })
    .eq('id', logId);

  return { applied, failed: errors.length, errors };
}
