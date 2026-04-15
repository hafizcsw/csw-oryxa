// LAV #15.C: Search & Shortlist API Client
import { supabase } from "@/integrations/supabase/client";

export interface SearchFilters {
  q_name?: string;
  country_slug?: string;
  fees_min?: number;
  fees_max?: number;
  living_min?: number;
  living_max?: number;
  degree_id?: string;
  // certificate_id removed: vw_university_card has no certificate_types column
  has_dorm?: boolean;
  university_type?: string;
  rank_max?: number;
  sort?: 'popularity' | 'name_asc' | 'name_desc' | 'fees_asc' | 'fees_desc' | 'rank_asc' | 'rank_desc';
  limit?: number;
  offset?: number;
}

export interface ShortlistListResponse {
  ok: boolean;
  count: number;
  items: string[];
}

export interface SearchResponse {
  ok: boolean;
  tid: string;
  count: number;
  items: any[];
}

export async function fetchUniversities(filters: SearchFilters): Promise<SearchResponse> {
  console.log('fetchUniversities called with filters:', filters);
  
  try {
    // Try direct database query first for better reliability
    return await fetchUniversitiesDirect(filters);
  } catch (fallbackError: any) {
    console.error('Direct query failed:', fallbackError);
    throw new Error('Failed to search universities: ' + fallbackError.message);
  }
}

// Fallback: Direct database query
async function fetchUniversitiesDirect(filters: SearchFilters): Promise<SearchResponse> {
  try {
    let query = supabase
      .from('vw_university_card')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.q_name) query = query.ilike('name', `%${filters.q_name}%`);
    if (filters.country_slug) query = query.eq('country_slug', filters.country_slug);
    if (filters.fees_min !== undefined && filters.fees_min !== null) {
      query = query.gte('annual_fees', filters.fees_min);
    }
    if (filters.fees_max !== undefined && filters.fees_max !== null) {
      query = query.lte('annual_fees', filters.fees_max);
    }
    if (filters.living_min !== undefined && filters.living_min !== null) {
      query = query.gte('monthly_living', filters.living_min);
    }
    if (filters.living_max !== undefined && filters.living_max !== null) {
      query = query.lte('monthly_living', filters.living_max);
    }

    // Note: degree_id filtering requires contains on arrays
    if (filters.degree_id && filters.degree_id.trim()) {
      try {
        query = query.contains('degree_ids', [filters.degree_id]);
      } catch (e) {
        console.warn('Degree filter skipped in fallback:', e);
      }
    }
    // certificate_id removed: vw_university_card has no certificate_types column

    // New filters wired to vw_university_card columns
    if (filters.has_dorm !== undefined && filters.has_dorm !== null) {
      query = query.eq('has_dorm', filters.has_dorm);
    }
    if (filters.university_type && filters.university_type.trim()) {
      query = query.eq('university_type', filters.university_type);
    }
    if (filters.rank_max !== undefined && filters.rank_max !== null) {
      query = query.lte('world_rank', filters.rank_max);
    }

    // Apply sorting
    const sortOption = filters.sort || 'popularity';
    switch (sortOption) {
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'fees_asc':
        query = query.order('annual_fees', { ascending: true, nullsFirst: false });
        break;
      case 'fees_desc':
        query = query.order('annual_fees', { ascending: false, nullsFirst: false });
        break;
      case 'rank_asc':
        query = query.order('world_rank', { ascending: true, nullsFirst: false });
        break;
      case 'rank_desc':
        query = query.order('world_rank', { ascending: false, nullsFirst: false });
        break;
      case 'popularity':
      default:
        query = query.order('world_rank', { ascending: true, nullsFirst: false });
    }

    // Pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    console.log('Executing direct query with filters:', filters);
    const { data, error, count } = await query;

    if (error) {
      console.error('Direct query error:', error);
      throw new Error(error.message || 'Failed to fetch universities');
    }

    console.log('Direct query success:', { count, items: data?.length });

    return {
      ok: true,
      tid: 'direct-query-' + Date.now(),
      count: count || 0,
      items: data || []
    };
  } catch (err: any) {
    console.error('Direct query failed:', err);
    throw new Error(err.message || 'Failed to search universities');
  }
}

export interface ShortlistOperation {
  op: 'add' | 'remove';
  student_id: string;
  country_id: string;
  university_id: string;
}

export interface ShortlistResponse {
  ok: boolean;
  tid: string;
  count: number;
  code?: string;
}

/**
 * ❌ DEPRECATED V1 API - DO NOT USE
 * Use useUnifiedShortlist.toggleWithSnapshot() instead
 * This function is kept for backwards compatibility but will throw an error
 */
export async function shortlistOp(_operation: ShortlistOperation): Promise<ShortlistResponse> {
  console.error('[shortlistOp] ❌ DEPRECATED - V1 API disabled. Use useUnifiedShortlist.toggleWithSnapshot() instead');
  throw new Error('shortlistOp is deprecated. Use useUnifiedShortlist.toggleWithSnapshot() for V3 snapshot sync.');
}

export async function getShortlistCount(studentId: string, countryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('student_shortlists')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('country_id', countryId);

  if (error) throw error;
  return count || 0;
}

export async function getShortlistItems(studentId: string, countryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('student_shortlists')
    .select('university_id')
    .eq('student_id', studentId)
    .eq('country_id', countryId);

  if (error) throw error;
  return (data || []).map(item => item.university_id);
}

export async function getShortlistList(studentId: string, countryId: string): Promise<ShortlistListResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('shortlist-list', {
      body: { student_id: studentId, country_id: countryId }
    });

    if (error) {
      console.error('Shortlist list error:', error);
      // Fallback to direct query
      const count = await getShortlistCount(studentId, countryId);
      const items = await getShortlistItems(studentId, countryId);
      return { ok: true, count, items };
    }
    
    if (!data) {
      throw new Error('No data returned from shortlist list');
    }
    
    return data;
  } catch (err: any) {
    console.error('Shortlist list failed:', err);
    // Fallback to direct query
    const count = await getShortlistCount(studentId, countryId);
    const items = await getShortlistItems(studentId, countryId);
    return { ok: true, count, items };
  }
}
