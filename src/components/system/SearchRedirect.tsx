/**
 * ============= Smart Search Redirect =============
 * Redirects from legacy /search route to canonical /universities?tab=programs
 * Preserves and maps query parameters.
 * 
 * Mapping:
 * - q, keyword → q (for keyword search)
 * - country → country_slug
 * - degree → degree_id
 * - language → language
 * - fees_max → fees_max
 * - living_max → living_max
 * - has_dorm → has_dorm
 * - dorm_max → dorm_max
 * - sort → sort
 */
import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

// Mapping from old param names to new canonical names
const PARAM_MAP: Record<string, string> = {
  // Keyword variants
  q: 'q',
  keyword: 'q',
  query: 'q',
  
  // Country variants
  country: 'country_slug',
  country_code: 'country_slug',
  
  // Degree variants
  degree: 'degree_id',
  degree_level: 'degree_id',
  degree_slug: 'degree_id',
  
  // Language (keep as is)
  language: 'language',
  instruction_language: 'language',
  
  // Fees
  fees_max: 'fees_max',
  max_tuition: 'fees_max',
  tuition_max: 'fees_max',
  
  // Living costs
  living_max: 'living_max',
  max_monthly_living: 'living_max',
  monthly_living_max: 'living_max',
  
  // Dorm
  has_dorm: 'has_dorm',
  dorm_max: 'dorm_max',
  max_dorm_price: 'dorm_max',
  
  // Sort
  sort: 'sort',
  sort_by: 'sort',
  
  // Tab (preserve)
  tab: 'tab',
  
  // Subject/discipline
  subject: 'subject',
  discipline: 'subject',
  discipline_slug: 'subject',
};

export function SearchRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Build new query string with mapped params
    const newParams = new URLSearchParams();
    
    // Default tab to programs if not specified
    if (!searchParams.has('tab')) {
      newParams.set('tab', 'programs');
    }
    
    // Map all params
    searchParams.forEach((value, key) => {
      const mappedKey = PARAM_MAP[key] || key;
      // Don't duplicate if already set
      if (!newParams.has(mappedKey) && value) {
        newParams.set(mappedKey, value);
      }
    });

    const queryString = newParams.toString();
    const targetUrl = `/universities${queryString ? `?${queryString}` : '?tab=programs'}`;
    
    console.log('[SearchRedirect] Redirecting:', {
      from: `/search?${searchParams.toString()}`,
      to: targetUrl,
    });

    // Use replace to not add to history
    navigate(targetUrl, { replace: true });
  }, [searchParams, navigate]);

  return null;
}
