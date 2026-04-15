/**
 * CSV Parser – validates and parses CSV text into structured rows
 */
import type { EntityType, ParsedRow, ParseResult, RowStatus } from '../types';
import { REQUIRED_HEADERS } from '../types';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(text: string, entityType: EntityType): ParseResult {
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    return { headers: [], rows: [], totalRows: 0, validRows: 0, invalidRows: 0, skippedRows: 0 };
  }

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const required = REQUIRED_HEADERS[entityType];
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = values[idx] || '';
    });

    const errors: string[] = [];

    // Check required fields
    for (const req of required) {
      if (!data[req]?.trim()) {
        errors.push(`Missing required field: ${req}`);
      }
    }

    // Check column count mismatch
    if (values.length !== headers.length) {
      errors.push(`Column count mismatch: expected ${headers.length}, got ${values.length}`);
    }

    let status: RowStatus = 'valid';
    if (errors.length > 0) {
      status = 'invalid';
    }

    rows.push({ index: i, status, data, errors });
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    validRows: rows.filter(r => r.status === 'valid').length,
    invalidRows: rows.filter(r => r.status === 'invalid').length,
    skippedRows: rows.filter(r => r.status === 'skipped').length,
  };
}
