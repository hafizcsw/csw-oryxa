/**
 * useClientEvents Hook - UI → CRM
 * Records user actions as events for analytics and CRM intelligence
 * ✅ Uses React Context instead of window/localStorage
 * ✅ ORDER #1: Uses Gateway for all CRM calls
 */

import { useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { buildUiContextV1 } from '@/lib/uiContext';
import { sendChatEvent } from '@/lib/chat/gateway';

// Event types whitelist
export type ClientEventName = 
  | 'shortlist_toggle'
  | 'program_opened'
  | 'cards_show_all'
  | 'cards_show_more'
  | 'service_viewed'
  | 'service_selected'
  | 'tab_opened';  // P8: Track tab navigation

export type ClientEventPayload = Record<string, unknown>;

// Deduplication window
const DEDUP_WINDOW_MS = 800;

export function useClientEvents() {
  const { sessionId } = useMalakChat();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  
  // Deduplication ref
  const lastRef = useRef<{ key: string; t: number } | null>(null);
  
  const emit = useCallback(async (name: ClientEventName, payload: ClientEventPayload): Promise<boolean> => {
    if (!sessionId) {
      if (import.meta.env.DEV) console.warn('[useClientEvents] No session ID, skipping event:', name);
      return false;
    }
    
    // Build UI context from React Router (not window)
    const tab = searchParams.get('tab');
    const ui_context = buildUiContextV1({
      pathname: location.pathname,
      tab,
      lang: language || 'ar'
    });
    
    // Deduplication check
    const dedupKey = `${name}:${JSON.stringify(payload)}`;
    const now = Date.now();
    if (lastRef.current && lastRef.current.key === dedupKey && now - lastRef.current.t < DEDUP_WINDOW_MS) {
      console.log('[useClientEvents] ⏭️ Skipping duplicate:', name);
      return false;
    }
    lastRef.current = { key: dedupKey, t: now };
    
    // Get visitor_id from localStorage (this is the only acceptable use)
    const visitor_id = localStorage.getItem('malak_visitor_id') || sessionId;
    
    if (import.meta.env.DEV) {
      console.log('[useClientEvents] 📤 Emitting:', name, payload);
    }
    
    try {
      // ✅ ORDER #1: Use Gateway for all CRM calls
      const response = await sendChatEvent({
        name,
        payload,
        visitor_id,
        session_id: sessionId,
        ui_context,
      });
      
      if (!response.ok) {
        console.error('[useClientEvents] ❌ Failed:', name, response.error);
        return false;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useClientEvents] ✅ Emitted:', name);
      }
      return true;
      
    } catch (err) {
      console.error('[useClientEvents] ❌ Error:', name, err);
      return false;
    }
  }, [sessionId, location.pathname, searchParams, language]);
  
  // Convenience methods
  const emitShortlistToggle = useCallback((programId: string, toState: 'saved' | 'removed') => {
    return emit('shortlist_toggle', { program_id: programId, to_state: toState });
  }, [emit]);
  
  const emitProgramOpened = useCallback((programId: string) => {
    return emit('program_opened', { program_id: programId });
  }, [emit]);
  
  const emitCardsShowAll = useCallback((total: number) => {
    return emit('cards_show_all', { total });
  }, [emit]);
  
  const emitCardsShowMore = useCallback((fromCount: number, toCount: number) => {
    return emit('cards_show_more', { from_count: fromCount, to_count: toCount });
  }, [emit]);
  
  const emitServiceViewed = useCallback((serviceId: string) => {
    return emit('service_viewed', { service_id: serviceId });
  }, [emit]);
  
  const emitServiceSelected = useCallback((serviceId: string) => {
    return emit('service_selected', { service_id: serviceId });
  }, [emit]);
  
  // P8: Tab navigation tracking
  const emitTabOpened = useCallback((tabId: string) => {
    return emit('tab_opened', { tab_id: tabId });
  }, [emit]);
  
  return {
    emit,
    emitShortlistToggle,
    emitProgramOpened,
    emitCardsShowAll,
    emitCardsShowMore,
    emitServiceViewed,
    emitServiceSelected,
    emitTabOpened
  };
}
