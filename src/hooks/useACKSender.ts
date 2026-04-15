/**
 * useACKSender Hook
 * Sends ACK events to CRM via assistant-process gateway
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildUiContextV1 } from '@/lib/uiContext';
import { createDeterministicAckId, sendChatAck } from '@/lib/chat/gateway';
import { readAckedIds, readLastAckedCards, shouldSendCardsAck, writeAckedId, writeLastAckedCards } from '@/lib/chat/ackDedupe';
import { sendPortalEvent, PORTAL_EVENTS } from '@/lib/chat/telemetry';
import { getCrmTraceId } from '@/lib/crmHeaders';
import { shouldBlockAckId, shouldPersistAckId } from './ackDedupePolicy';

export type ACKName =
  | 'tab_opened'
  | 'scrolled_to'
  | 'field_highlighted'
  | 'notice_shown'
  | 'modal_opened'
  | 'document_focused'
  | 'cta_focused'
  | 'data_refreshed'
  | 'cards_rendered'
  | 'profile_saved'
  | 'program_selected'
  | 'shortlist_toggled';

export interface ACKPayload {
  name: ACKName;
  ref: {
    event_id?: string;
    query_id?: string;
    sequence?: number;
    patch_id?: string;
    program_id?: string;
  };
  success: boolean;
  metadata?: Record<string, any>;
}

const ackDedupStore = new Set<string>();


function getVisitorId(): string {
  const VISITOR_KEY = 'malak_visitor_id';
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }
  return visitorId;
}

export function useACKSender() {
  const { sessionId, customerId } = useMalakChat();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const visitorId = useMemo(() => getVisitorId(), []);
  const lastAckedCardsRef = useRef(readLastAckedCards(sessionId || undefined));
  const persistedAckIdsRef = useRef(readAckedIds(sessionId || undefined));

  useEffect(() => {
    lastAckedCardsRef.current = readLastAckedCards(sessionId || undefined);
    persistedAckIdsRef.current = readAckedIds(sessionId || undefined);
  }, [sessionId]);

  const sendACK = useCallback(async (ack: ACKPayload) => {
    if (!visitorId) return false;

    if (ack.name === 'cards_rendered') {
      if (!ack.ref.query_id || typeof ack.ref.sequence !== 'number') {
        console.warn('[ACKSender] ⛔ Rejected legacy cards_rendered ACK (missing query_id/sequence)');
        sendPortalEvent(PORTAL_EVENTS.ACK_SKIPPED_CONTRACT, {
          timestamp: new Date().toISOString(),
          ack_name: ack.name,
          success: false,
        });
        return false;
      }

      if (ack.success) {
        const renderedCount = Number((ack.metadata as Record<string, unknown> | undefined)?.count ?? NaN);
        if (!Number.isFinite(renderedCount) || renderedCount <= 0) {
          console.warn('[ACKSender] ⛔ Rejected cards_rendered ACK without successful render count');
          sendPortalEvent(PORTAL_EVENTS.ACK_SKIPPED_CONTRACT, {
            timestamp: new Date().toISOString(),
            ack_name: ack.name,
            query_id: ack.ref.query_id,
            sequence: ack.ref.sequence,
            success: false,
          });
          return false;
        }
      }
    }


    if (ack.name === 'cards_rendered') {
      if (!shouldSendCardsAck(ack.ref, lastAckedCardsRef.current)) {
        console.warn('[ACKSender] ⛔ Duplicate/stale cards ACK blocked', ack.ref);
        sendPortalEvent(PORTAL_EVENTS.ACK_SKIPPED_CONTRACT, {
          timestamp: new Date().toISOString(),
          ack_name: ack.name,
          query_id: ack.ref.query_id,
          sequence: ack.ref.sequence,
          success: false,
        });
        return false;
      }
    }

    const ack_id = createDeterministicAckId({
      ack_name: ack.name,
      ack_ref: ack.ref,
      ack_success: ack.success,
    }, sessionId || 'anonymous');
    if (ackDedupStore.has(ack_id) || shouldBlockAckId(ack.name, ack_id, persistedAckIdsRef.current)) {
      console.warn('[ACKSender] ⛔ Duplicate ACK blocked:', ack_id);
      sendPortalEvent(PORTAL_EVENTS.ACK_SKIPPED_CONTRACT, {
        timestamp: new Date().toISOString(),
        ack_name: ack.name,
        query_id: ack.ref.query_id,
        sequence: ack.ref.sequence,
        success: false,
      });
      return false;
    }

    const ui_context = buildUiContextV1({
      pathname: location.pathname,
      tab: searchParams.get('tab'),
      lang: language,
    });

    try {
      const clientTraceId = getCrmTraceId();
      // ✅ ORDER #1: Use Gateway for all CRM calls
      const response = await sendChatAck({
        ack_name: ack.name,
        ack_ref: ack.ref,
        ack_success: ack.success,
        ack_id,
        ack_metadata: {
          ...(ack.metadata || {}),
        },
        session_id: sessionId || undefined,
        visitor_id: visitorId,
        customer_id: customerId || undefined,
        ui_context,
        client_trace_id: clientTraceId,
      });

      if (!response.ok) {
        sendPortalEvent(PORTAL_EVENTS.ACK_FAILED, {
          timestamp: new Date().toISOString(),
          ack_name: ack.name,
          query_id: ack.ref.query_id,
          sequence: ack.ref.sequence,
          success: false,
        });
        return false;
      }

      ackDedupStore.add(ack_id);
      if (shouldPersistAckId(ack.name)) {
        persistedAckIdsRef.current.add(ack_id);
        writeAckedId(ack_id, sessionId || undefined);
      }
      if (ack.name === 'cards_rendered' && ack.ref.query_id && typeof ack.ref.sequence === 'number') {
        const latest = { query_id: ack.ref.query_id, sequence: ack.ref.sequence };
        lastAckedCardsRef.current = latest;
        writeLastAckedCards(latest, sessionId || undefined);
      }
      sendPortalEvent(PORTAL_EVENTS.ACK_SENT, {
        timestamp: new Date().toISOString(),
        ack_name: ack.name,
        query_id: ack.ref.query_id,
        sequence: ack.ref.sequence,
        count: Number((ack.metadata as Record<string, unknown> | undefined)?.count ?? 0),
        success: true,
      });

      return true;
    } catch {
      return false;
    }
  }, [sessionId, visitorId, customerId, location.pathname, searchParams, language]);

  return { sendACK, visitorId };
}
