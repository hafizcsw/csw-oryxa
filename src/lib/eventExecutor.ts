/**
 * Event Executor v2 - CRM → UI
 * Executes commands from CRM: open tabs, scroll, highlight fields, show notices, focus document, focus CTA
 */

import { toast } from 'sonner';

// Whitelist of allowed event types
export type CRMEventType = 
  | 'open_tab'
  | 'scroll_to'
  | 'highlight_field'
  | 'show_notice'
  | 'open_modal'
  | 'focus_document'
  | 'focus_cta'
  | 'refresh_data';

export interface CRMExecutableEvent {
  id?: string;
  type: CRMEventType | string;
  payload?: Record<string, any>;
  timestamp?: string;
}

// Tabs that can be opened
type AllowedTab = 'profile' | 'shortlist' | 'documents' | 'payments' | 'services' | 'applications';

// Scroll targets
type ScrollTarget = 'suggested_programs' | 'services_section' | 'profile_form';

// Highlightable fields
type HighlightableField = 'passport_name' | 'country' | 'degree_level' | 'major' | 'birth_date';

// Notice tones
type NoticeTone = 'info' | 'success' | 'warning' | 'error';

// Modal types
type ModalType = 'auth' | 'service_details';

// Persistent idempotency using sessionStorage
const STORAGE_KEY = 'crm_executed_events';
const MAX_STORED = 200;

/**
 * Get executed events from sessionStorage (persistent across renders, cleared on session end)
 */
function getExecutedEvents(): Set<string> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

/**
 * Save executed events to sessionStorage
 */
function saveExecutedEvents(events: Set<string>): void {
  try {
    // Ring buffer: keep last MAX_STORED
    const arr = Array.from(events).slice(-MAX_STORED);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Silent fail - storage might be full or disabled
  }
}

/**
 * Generate a hash for an event to ensure idempotency
 * Prefers event.id if provided by CRM (deterministic)
 */
function generateEventHash(event: CRMExecutableEvent): string {
  if (event.id) return event.id;
  
  const payload = JSON.stringify(event.payload || {});
  const timestamp = event.timestamp || '';
  return `${event.type}:${payload}:${timestamp}`;
}

/**
 * Check if event was already executed (persistent)
 */
function wasExecuted(eventHash: string): boolean {
  return getExecutedEvents().has(eventHash);
}

/**
 * Mark event as executed (persistent)
 */
function markExecuted(eventHash: string): void {
  const events = getExecutedEvents();
  events.add(eventHash);
  saveExecutedEvents(events);
}

/**
 * Execute open_tab event
 */
function executeOpenTab(payload: { tab?: AllowedTab } | undefined, navigate: (path: string) => void): boolean {
  const allowedTabs: AllowedTab[] = ['profile', 'shortlist', 'documents', 'payments', 'services', 'applications'];
  
  if (!payload?.tab || !allowedTabs.includes(payload.tab)) {
    console.warn('[EventExecutor] Invalid tab:', payload.tab);
    return false;
  }
  
  navigate(`/account?tab=${payload.tab}`);
  console.log('[EventExecutor] ✅ Opened tab:', payload.tab);
  return true;
}

/**
 * Execute scroll_to event
 */
function executeScrollTo(payload: { target?: ScrollTarget } | undefined): boolean {
  const targetMap: Record<ScrollTarget, string> = {
    'suggested_programs': '[data-section="suggested-programs"]',
    'services_section': '[data-section="services"]',
    'profile_form': '[data-section="profile-form"]'
  };
  
  if (!payload?.target || !targetMap[payload.target]) {
    console.warn('[EventExecutor] Invalid scroll target:', payload?.target);
    return false;
  }
  
  const selector = targetMap[payload.target];
  const element = document.querySelector(selector);
  
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    console.log('[EventExecutor] ✅ Scrolled to:', payload.target);
    return true;
  } else {
    console.warn('[EventExecutor] Element not found:', selector);
    return false;
  }
}

/**
 * Execute highlight_field event
 */
function executeHighlightField(payload: { field?: HighlightableField } | undefined): boolean {
  const allowedFields: HighlightableField[] = ['passport_name', 'country', 'degree_level', 'major', 'birth_date'];
  
  if (!payload?.field || !allowedFields.includes(payload.field)) {
    console.warn('[EventExecutor] Invalid field:', payload?.field);
    return false;
  }
  
  // Try multiple selector strategies
  const selectors = [
    `[name="${payload.field}"]`,
    `[data-field="${payload.field}"]`,
    `#${payload.field}`,
    `#field-${payload.field}`
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      // Scroll to element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Focus if focusable
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        element.focus();
      }
      
      // Add highlight animation
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 3000);
      
      console.log('[EventExecutor] ✅ Highlighted field:', payload.field);
      return true;
    }
  }
  
  console.warn('[EventExecutor] Field not found:', payload.field);
  return false;
}

/**
 * Execute show_notice event
 */
function executeShowNotice(payload: { message?: string; tone?: NoticeTone } | undefined): boolean {
  if (!payload?.message) {
    console.warn('[EventExecutor] Missing notice message');
    return false;
  }
  
  const tone = payload.tone || 'info';
  
  switch (tone) {
    case 'success':
      toast.success(payload.message);
      break;
    case 'warning':
      toast.warning(payload.message);
      break;
    case 'error':
      toast.error(payload.message);
      break;
    case 'info':
    default:
      toast.info(payload.message);
  }
  
  console.log('[EventExecutor] ✅ Showed notice:', tone, payload.message.slice(0, 50));
  return true;
}

/**
 * Execute open_modal event
 */
function executeOpenModal(
  payload: { modal?: ModalType } | undefined, 
  openAuthModal?: () => void
): boolean {
  if (!payload?.modal) {
    console.warn('[EventExecutor] Missing modal type');
    return false;
  }
  
  switch (payload.modal) {
    case 'auth':
      if (openAuthModal) {
        openAuthModal();
        console.log('[EventExecutor] ✅ Opened auth modal');
        return true;
      }
      console.warn('[EventExecutor] Auth modal opener not provided');
      return false;
      
    case 'service_details':
      // This would need to be implemented based on your modal system
      console.log('[EventExecutor] ⚠️ service_details modal not implemented yet');
      return false;
      
    default:
      console.warn('[EventExecutor] Unknown modal type:', payload.modal);
      return false;
  }
}

/**
 * Execute focus_document event - scrolls to and highlights a document card
 */
function executeFocusDocument(payload: { doc_id?: string; doc_kind?: string } | undefined): boolean {
  if (!payload?.doc_id && !payload?.doc_kind) {
    console.warn('[EventExecutor] focus_document requires doc_id or doc_kind');
    return false;
  }
  
  // Try multiple selector strategies
  const selectors = [
    payload.doc_id ? `[data-doc-id="${payload.doc_id}"]` : null,
    payload.doc_kind ? `[data-doc-kind="${payload.doc_kind}"]` : null,
  ].filter(Boolean) as string[];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      // Scroll to element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight animation
      element.classList.add('ring-2', 'ring-destructive', 'ring-offset-2', 'animate-pulse');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2', 'animate-pulse');
      }, 4000);
      
      console.log('[EventExecutor] ✅ Focused document:', payload.doc_id || payload.doc_kind);
      return true;
    }
  }
  
  console.warn('[EventExecutor] Document not found:', payload);
  return false;
}

/**
 * Execute focus_cta event - highlights the floating CTA
 */
function executeFocusCta(): boolean {
  const selectors = [
    '#floating-student-cta',
    '[data-floating-cta="true"]',
    '[data-tour-id="floating-cta"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      // Add bounce/glow animation
      element.classList.add('animate-bounce', 'ring-4', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('animate-bounce', 'ring-4', 'ring-primary', 'ring-offset-2');
      }, 3000);
      
      console.log('[EventExecutor] ✅ Focused CTA');
      return true;
    }
  }
  
  console.warn('[EventExecutor] Floating CTA not found');
  return false;
}

/**
 * Main executor function
 */
export function executeEvent(
  event: CRMExecutableEvent,
  handlers: {
    navigate: (path: string) => void;
    openAuthModal?: () => void;
    onRefreshData?: () => void;
  }
): boolean {
  // Generate hash for idempotency
  const eventHash = generateEventHash(event);
  
  // Skip if already executed
  if (wasExecuted(eventHash)) {
    console.log('[EventExecutor] ⏭️ Skipping duplicate event:', event.type);
    return false;
  }
  
  // Execute based on type
  let success = false;
  
  switch (event.type) {
    case 'open_tab':
      success = executeOpenTab(event.payload, handlers.navigate);
      break;
      
    case 'scroll_to':
      success = executeScrollTo(event.payload);
      break;
      
    case 'highlight_field':
      success = executeHighlightField(event.payload);
      break;
      
    case 'show_notice':
      success = executeShowNotice(event.payload);
      break;
      
    case 'open_modal':
      success = executeOpenModal(event.payload, handlers.openAuthModal);
      break;
      
    case 'focus_document':
      success = executeFocusDocument(event.payload);
      break;
      
    case 'focus_cta':
      success = executeFocusCta();
      break;
      
    case 'refresh_data':
      if (handlers.onRefreshData) {
        handlers.onRefreshData();
        console.log('[EventExecutor] ✅ Triggered data refresh');
        success = true;
      } else {
        console.warn('[EventExecutor] refresh_data handler not provided');
      }
      break;
      
    default:
      console.warn('[EventExecutor] Unknown event type:', event.type);
      return false;
  }
  
  // Mark as executed if successful
  if (success) {
    markExecuted(eventHash);
  }
  
  return success;
}

/**
 * Execute multiple events
 */
export function executeEvents(
  events: CRMExecutableEvent[],
  handlers: {
    navigate: (path: string) => void;
    openAuthModal?: () => void;
    onRefreshData?: () => void;
  }
): number {
  let executed = 0;
  
  for (const event of events) {
    if (executeEvent(event, handlers)) {
      executed++;
    }
  }
  
  return executed;
}

/**
 * Clear executed events cache (useful for testing or new session)
 */
export function clearExecutedEventsCache(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent fail
  }
}

/**
 * Map event type to ACK name
 */
export function mapEventTypeToAckName(eventType: string): string {
  const mapping: Record<string, string> = {
    'open_tab': 'tab_opened',
    'scroll_to': 'scrolled_to',
    'highlight_field': 'field_highlighted',
    'show_notice': 'notice_shown',
    'open_modal': 'modal_opened',
    'focus_document': 'document_focused',
    'focus_cta': 'cta_focused',
    'refresh_data': 'data_refreshed',
  };
  return mapping[eventType] || eventType;
}
