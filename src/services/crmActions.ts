/**
 * CRM Actions Service
 * Handles program actions (select/shortlist/apply) with CRM as truth
 * 
 * ⚠️ DEPRECATED: Use useUnifiedShortlist hook instead for shortlist operations
 * This file is kept for backward compatibility with select/apply actions only
 */

import { supabase } from '@/integrations/supabase/client';

export type ProgramActionType = 'select' | 'apply';
export type ActionSource = 'portal_cards' | 'search_results' | 'shortlist_tab' | 'program_page';

export interface ProgramAction {
  action: ProgramActionType;
  program_id: string;
  customer_id: string;
  client_action_id: string;
  source: ActionSource;
}

export interface ProgramActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Set program action in CRM (select/apply only)
 * 
 * ⚠️ For shortlist operations, use useUnifiedShortlist hook
 */
export async function setProgramAction(action: ProgramAction): Promise<ProgramActionResult> {
  console.log('[crmActions] 📤 Sending action:', action);
  
  try {
    const { data, error } = await supabase.functions.invoke('student-portal-api', {
      body: {
        action: action.action === 'select' ? 'set_program_selection' : 'submit_application',
        program_id: action.program_id,
        source: action.source,
        client_action_id: action.client_action_id,
      }
    });
    
    if (error) {
      console.error('[crmActions] ❌ API error:', error);
      return { ok: false, error: error.message };
    }
    
    console.log('[crmActions] ✅ Action successful:', data);
    return { ok: data?.ok === true || data?.success === true };
  } catch (e) {
    console.error('[crmActions] ❌ Exception:', e);
    return { ok: false, error: String(e) };
  }
}

// ✅ P0-LOCK-4: Removed all V1 shortlist sync functions (syncShortlistToCRM, toggleShortlistAndSync)
// Use useUnifiedShortlist.toggleWithSnapshot() instead
