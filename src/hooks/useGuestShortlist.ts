/**
 * Guest-Aware Shortlist Hook
 * Wraps usePortalShortlist + localStorage guest draft
 * - Guest: localStorage-based, no auth required
 * - Authenticated: delegates to CRM RPC
 * - On login: merges guest draft into authenticated shortlist
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalShortlist } from '@/hooks/usePortalShortlist';
import { trackShortlistAdded } from '@/lib/decisionTracking';
import { track } from '@/lib/analytics';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';

const GUEST_SHORTLIST_KEY = 'guest_shortlist_draft';
const MAX_GUEST_SHORTLIST = 10;

export interface GuestShortlistItem {
  program_id: string;
  added_at: string;
}

function loadGuestDraft(): GuestShortlistItem[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_SHORTLIST_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveGuestDraft(items: GuestShortlistItem[]) {
  localStorage.setItem(GUEST_SHORTLIST_KEY, JSON.stringify(items));
}

export function clearGuestDraft() {
  localStorage.removeItem(GUEST_SHORTLIST_KEY);
}

/**
 * Sync guest draft items to authenticated shortlist.
 * Called post-login from HeaderAuth.
 */
export async function syncGuestDraftToAuth(): Promise<{ synced: number; errors: number }> {
  const draft = loadGuestDraft();
  if (draft.length === 0) return { synced: 0, errors: 0 };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  // Import dynamically to avoid circular deps
  const { shortlistAddNew } = await import('@/lib/portalApi');

  for (const item of draft) {
    try {
      // Fetch snapshot for each program
      const { data } = await supabase
        .from('vw_program_search_api_v3_final' as any)
        .select('program_id, program_name_ar, program_name_en, university_name_ar, university_name_en, university_logo_url, country_name_ar, country_name_en, country_code, degree_name, degree_slug, duration_months, tuition_usd_year_max, tuition_usd_year_min, city')
        .eq('program_id', item.program_id)
        .maybeSingle();

      const snapshot = data ? {
        program_name_en: (data as any).program_name_en,
        program_name_ar: (data as any).program_name_ar,
        university_name_en: (data as any).university_name_en,
        university_name_ar: (data as any).university_name_ar,
        university_logo: (data as any).university_logo_url,
        country_name_en: (data as any).country_name_en,
        country_name_ar: (data as any).country_name_ar,
        country_code: (data as any).country_code,
        degree_level: (data as any).degree_name || (data as any).degree_slug,
        duration_months: (data as any).duration_months,
        tuition_usd_min: (data as any).tuition_usd_year_min,
        tuition_usd_max: (data as any).tuition_usd_year_max,
        city: (data as any).city,
        portal_url: `${window.location.origin}/program/${item.program_id}`,
      } : undefined;

      const res = await shortlistAddNew(item.program_id, snapshot, 'guest_sync');
      if (res.ok) synced++;
      else errors++;
    } catch {
      errors++;
    }
  }

  if (synced > 0) {
    clearGuestDraft();
    console.log(`[GuestShortlist] ✅ Synced ${synced} guest items to account`);
  }

  return { synced, errors };
}

/**
 * Guest-aware program shortlist hook.
 * No auth required for add/remove. 
 * Authenticated users get CRM sync automatically.
 */
export function useGuestAwareShortlist() {
  const portal = usePortalShortlist();
  const [guestItems, setGuestItems] = useState<GuestShortlistItem[]>(loadGuestDraft);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ✅ Cross-instance sync: listen for guest shortlist changes from other hook instances
  useEffect(() => {
    const onAdd = () => setGuestItems(loadGuestDraft());
    const onRemove = () => setGuestItems(loadGuestDraft());
    window.addEventListener('guest-shortlist-add', onAdd);
    window.addEventListener('guest-shortlist-remove', onRemove);
    return () => {
      window.removeEventListener('guest-shortlist-add', onAdd);
      window.removeEventListener('guest-shortlist-remove', onRemove);
    };
  }, []);

  const isAuthenticated = !!session?.access_token;

  // For authenticated users, delegate entirely to portal hook
  // For guests, use localStorage draft
  const isInShortlist = useCallback((programId: string): boolean => {
    if (isAuthenticated) return portal.isInShortlist(programId);
    return guestItems.some(item => item.program_id === programId);
  }, [isAuthenticated, portal, guestItems]);

  const count = isAuthenticated ? portal.count : guestItems.length;

  const add = useCallback(async (programId: string) => {
    // Fire analytics regardless of auth state
    track('shortlist_added', { program_id: programId });
    trackShortlistAdded(programId);

    if (isAuthenticated) {
      // Delegate to portal (CRM RPC)
      return portal.add(programId);
    }

    // Guest mode: localStorage draft
    if (guestItems.some(item => item.program_id === programId)) {
      return { ok: true, already_exists: true };
    }

    if (guestItems.length >= MAX_GUEST_SHORTLIST) {
      toast.error(`يمكنك إضافة ${MAX_GUEST_SHORTLIST} برامج كحد أقصى`);
      return { ok: false, error_code: 'shortlist_limit_reached' };
    }

    const newItem: GuestShortlistItem = {
      program_id: programId,
      added_at: new Date().toISOString(),
    };
    const updated = [...guestItems, newItem];
    setGuestItems(updated);
    saveGuestDraft(updated);
    
    // Also add to MalakChat context for UI consistency
    try {
      const { useMalakChat } = await import('@/contexts/MalakChatContext');
      // Can't use hook here, dispatch event instead
      window.dispatchEvent(new CustomEvent('guest-shortlist-add', { detail: { program_id: programId } }));
    } catch {}

    toast.success('تمت الإضافة للمفضلة ❤️');
    console.log('[GuestShortlist] ✅ Added to guest draft:', programId);
    return { ok: true, added: true, count: updated.length, limit: MAX_GUEST_SHORTLIST, limit_reached: updated.length >= MAX_GUEST_SHORTLIST };
  }, [isAuthenticated, portal, guestItems]);

  const remove = useCallback(async (programId: string) => {
    track('shortlist_removed', { program_id: programId });

    if (isAuthenticated) {
      return portal.remove(programId);
    }

    const updated = guestItems.filter(item => item.program_id !== programId);
    setGuestItems(updated);
    saveGuestDraft(updated);
    
    window.dispatchEvent(new CustomEvent('guest-shortlist-remove', { detail: { program_id: programId } }));
    
    toast.success('تمت الإزالة من المفضلة');
    console.log('[GuestShortlist] ✅ Removed from guest draft:', programId);
    return { ok: true, removed: true };
  }, [isAuthenticated, portal, guestItems]);

  return {
    items: isAuthenticated ? portal.items : guestItems.map(g => ({ program_id: g.program_id, created_at: g.added_at })),
    count,
    limit: isAuthenticated ? portal.limit : MAX_GUEST_SHORTLIST,
    isLoading: isAuthenticated ? portal.isLoading : false,
    isAuthenticated,
    add,
    remove,
    isInShortlist,
    refresh: portal.refresh,
    isAdding: portal.isAdding,
    isRemoving: portal.isRemoving,
  };
}
