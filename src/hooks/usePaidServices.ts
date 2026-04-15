import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceRegion {
  id: string;
  slug: string;
  name_key: string;
  country_codes: string[];
  display_order: number;
}

export interface PaidService {
  id: string;
  region_id: string;
  category: 'language_course' | 'student_service' | 'admission' | 'bundle';
  name_key: string;
  description_key: string;
  tier: string | null;
  price_usd: number;
  features: string[];
  is_popular: boolean;
  display_order: number;
}

export function useServiceRegions() {
  return useQuery({
    queryKey: ['service-regions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('service_regions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as ServiceRegion[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function usePaidServices(regionId: string | null) {
  return useQuery({
    queryKey: ['paid-services', regionId],
    queryFn: async () => {
      if (!regionId) return [];
      const { data, error } = await (supabase as any)
        .from('paid_services')
        .select('*')
        .eq('region_id', regionId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data as PaidService[]).map(s => ({
        ...s,
        features: typeof s.features === 'string' ? JSON.parse(s.features) : s.features,
      }));
    },
    enabled: !!regionId,
    staleTime: 1000 * 60 * 30,
  });
}
