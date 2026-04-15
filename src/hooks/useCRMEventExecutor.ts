/**
 * useCRMEventExecutor Hook
 * Executes CRM events received in responses + sends ACKs
 */

import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRMExecutableEvent, executeEvents, mapEventTypeToAckName } from '@/lib/eventExecutor';
import { useACKSender, ACKName } from './useACKSender';

interface UseCRMEventExecutorOptions {
  openAuthModal?: () => void;
  onRefreshData?: () => void;
}

export function useCRMEventExecutor(options: UseCRMEventExecutorOptions = {}) {
  const navigate = useNavigate();
  const { openAuthModal, onRefreshData } = options;
  const { sendACK } = useACKSender();
  
  // Track last processed events to avoid re-processing
  const lastProcessedRef = useRef<string | null>(null);
  
  const executeResponseEvents = useCallback((events: CRMExecutableEvent[] | undefined | null) => {
    if (!events || events.length === 0) return 0;
    
    // Create a simple hash of events for deduplication
    const eventsHash = JSON.stringify(events.map(e => ({ type: e.type, payload: e.payload })));
    
    // Skip if we just processed these exact events
    if (lastProcessedRef.current === eventsHash) {
      console.log('[useCRMEventExecutor] ⏭️ Skipping already processed events batch');
      return 0;
    }
    
    console.log('[useCRMEventExecutor] 🎯 Executing', events.length, 'CRM events');
    
    const executed = executeEvents(events as CRMExecutableEvent[], {
      navigate,
      openAuthModal,
      onRefreshData
    });
    
    // Remember this batch
    lastProcessedRef.current = eventsHash;
    
    console.log('[useCRMEventExecutor] ✅ Executed', executed, '/', events.length, 'events');
    
    // 🆕 Send ACK for each executed event with id
    for (const event of events) {
      if (event.id) {
        const ackName = mapEventTypeToAckName(event.type) as ACKName;
        sendACK({
          name: ackName,
          ref: { event_id: event.id },
          success: true,
        });
      }
    }
    
    return executed;
  }, [navigate, openAuthModal, onRefreshData, sendACK]);
  
  return { executeResponseEvents };
}
