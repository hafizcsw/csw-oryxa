/**
 * Returns the university_id if the current user is a page staff member.
 * Returns null if user is a regular student.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useStaffUniversityId() {
  const [staffUniId, setStaffUniId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setStaffUniId(null); return; }

        const { data } = await supabase
          .from('university_page_staff')
          .select('university_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        setStaffUniId(data?.university_id || null);
      } catch {
        setStaffUniId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { staffUniId, loading };
}
