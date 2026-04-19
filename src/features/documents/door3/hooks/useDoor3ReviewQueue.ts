// ═══════════════════════════════════════════════════════════════
// useDoor3ReviewQueue — list + resolve pending review items
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Door3ReviewItem, Door3ReviewState } from '../types';

export function useDoor3ReviewQueue() {
  const [items, setItems] = useState<Door3ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('document_review_queue')
      .select('*')
      .eq('state', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data ?? []) as Door3ReviewItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = useCallback(async (id: string, state: Door3ReviewState) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from('document_review_queue')
      .update({ state, resolved_by: u.user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  }, [load]);

  return { items, loading, reload: load, resolve };
}
