import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUniversityPageLaneFlag() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('feature_flags')
          .select('enabled')
          .eq('key', 'university_page_os_lane_enabled')
          .maybeSingle();
        if (data?.enabled === false) setEnabled(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { enabled, loading };
}
