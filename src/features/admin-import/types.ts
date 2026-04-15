/**
 * Admin Import Feature – Type Definitions
 */

export type EntityType = 'university' | 'program' | 'scholarship';

export type ImportStatus = 'pending' | 'applied' | 'failed' | 'partial';

export type RowStatus = 'valid' | 'invalid' | 'skipped';

export interface ParsedRow {
  index: number;
  status: RowStatus;
  data: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedRows: number;
}

export interface ApplyResult {
  applied: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface ImportLogRow {
  id: string;
  filename: string;
  import_type: string;
  entity_type: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  skipped_rows: number;
  applied_rows: number;
  error_details: Array<{ row: number; error: string }>;
  created_at: string;
  applied_at: string | null;
}

/** Required CSV headers per entity type */
export const REQUIRED_HEADERS: Record<EntityType, string[]> = {
  university: ['name', 'country_slug'],
  program: ['university_name', 'program_name', 'degree_slug'],
  scholarship: ['title', 'country_slug'],
};

/** All expected headers per entity type */
export const EXPECTED_HEADERS: Record<EntityType, string[]> = {
  university: [
    'name', 'country_slug', 'city', 'ranking', 'annual_fees',
    'monthly_living', 'website', 'logo_url', 'description',
  ],
  program: [
    'university_name', 'program_name', 'degree_slug', 'teaching_language',
    'delivery_mode', 'tuition_yearly', 'currency_code', 'ielts_required',
    'next_intake_date', 'duration_months',
  ],
  scholarship: [
    'title', 'country_slug', 'university_name', 'degree_slug',
    'amount', 'currency', 'deadline', 'url', 'notes',
  ],
};
