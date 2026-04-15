import { WebChatResponse } from './crm';
import { StageInfo, GuestState } from './chat';

/**
 * Legacy format (for backward compatibility)
 */
export interface LegacyAssistantResponse {
  ok: boolean;
  reply: string;
  need_name?: boolean;
  need_phone?: boolean;
  customer_id?: string;
  normalized_phone?: string;
  stage?: string;
  is_new_customer?: boolean;
  student_portal_token?: string;
  universities?: any[];
  stage_info?: StageInfo | null;
  guest_state?: GuestState | null; // 🆕 Guest memory tracking
}

/**
 * Modern format (extends WebChatResponse from CRM)
 */
export type AssistantResponse = WebChatResponse | LegacyAssistantResponse;

export interface SearchFilters {
  q_name?: string;
  country_slug?: string;
  degree_ids?: string[];
  fees_min?: number;
  fees_max?: number;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  ok: boolean;
  items: any[];
  count: number;
  etag?: string;
}
