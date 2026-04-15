import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { setForcedGuestMode, clearForcedGuestMode } from '@/lib/chat/session';
import { AccountRole } from '@/types/chat';

// Generate UUID without external dependency
const generateUUID = () => crypto.randomUUID();

interface AuthResult {
  ok: boolean;
  error?: string;
  error_code?:
    | 'invalid_phone'
    | 'customer_not_found'
    | 'already_has_account'
    | 'invalid_code'
    | 'too_many_attempts'
    | 'expired_code'
    | 'throttled'
  | 'server_error'
    | 'email_already_linked'
    | 'auth_account_already_configured'
    | string;
  masked_phone?: string;
  student_portal_token?: string;
  redirect_url?: string;
  customer_id?: string;
  account_role?: AccountRole;
  preferred_language?: string;
  guest_profile_attached?: boolean;
}

export function usePortalAuth() {
  const [isLoading, setIsLoading] = useState(false);
const { 
    setGuestSession, 
    setAuthenticatedSession, 
    openChat,
    guestSessionId,
  } = useMalakChat();

  /**
   * Ensure a guest_session_id exists for auth flow
   * If user came from chat, reuse existing ID. Otherwise, create new one.
   */
  const ensureGuestSessionId = (): string => {
    if (guestSessionId) {
      console.log('[usePortalAuth] 📌 Using existing guest_session_id:', guestSessionId);
      return guestSessionId;
    }
    
    const newId = generateUUID();
    setGuestSession(newId);
    console.log('[usePortalAuth] 🆕 Created guest_session_id for auth flow:', newId);
    return newId;
  };

  /**
   * Continue as guest - generates a guest session ID locally
   * PORTAL-ORDER-1: Set forced guest mode flag
   */
  const continueAsGuest = async () => {
    const guestSessionId = generateUUID();

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[usePortalAuth] ⚠️ Failed to sign out before guest mode:', error);
    }
    
    // PORTAL-ORDER-1: Set forced guest flag + clear any auth context
    setForcedGuestMode();
    
    // Use context function which handles localStorage
    setGuestSession(guestSessionId);
    
    // Open chat after guest flow
    openChat();
    
    console.log('[usePortalAuth] ✅ Guest session started + forced guest mode enabled');
  };

  /**
   * Helper to handle successful auth response from CRM
   * Called after verifyLogin or verifySignup succeeds
   */
  const handleAuthSuccess = (data: AuthResult) => {
    if (!data.ok || !data.customer_id || !data.student_portal_token) return;
    
    const token = data.student_portal_token;
    
    // Use context function which handles localStorage
    setAuthenticatedSession({
      customer_id: data.customer_id,
      student_portal_token: token,
      account_role: data.account_role,
    });
    
    if (data.guest_profile_attached) {
      console.log('[usePortalAuth] ✅ Guest profile attached to customer in CRM');
    }
    
    console.log('[usePortalAuth] ✅ Auth success, customer:', data.customer_id);
    
    // ✅ Removed auto-redirect - user stays on current page after auth
    // Navigation should be handled by the component that initiated the auth flow
  };

  /**
   * Start login flow - sends OTP to phone via WhatsApp
   */
  const startLogin = async (phone: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const sessionId = ensureGuestSessionId();
      
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { 
          action: 'start-login', 
          phone, 
          channel: 'web_chat', // ✅ Unified channel across all layers
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'حدث خطأ أثناء إرسال الكود.',
          error_code: data?.error_code,
        };
      }

      console.log('[usePortalAuth] ✅ startLogin success, masked:', data.masked_phone);
      return {
        ok: true,
        masked_phone: data.masked_phone,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ startLogin error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify login OTP
   */
  const verifyLogin = async (phone: string, otpCode: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const sessionId = ensureGuestSessionId();
      
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { 
          action: 'verify-login', 
          phone, 
          otp_code: otpCode, 
          channel: 'web_chat', // ✅ Unified channel across all layers
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'حدث خطأ أثناء التحقق.',
          error_code: data?.error_code,
        };
      }

      // Call handleAuthSuccess internally
      handleAuthSuccess(data);
      
      console.log('[usePortalAuth] ✅ verifyLogin success, customer:', data.customer_id, 'redirect_url:', data.redirect_url?.slice(0, 60));
      return {
        ok: true,
        customer_id: data.customer_id,
        student_portal_token: data.student_portal_token,
        redirect_url: data.redirect_url || data.action_link,
        account_role: data.account_role,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ verifyLogin error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start signup flow - sends OTP to phone via WhatsApp
   */
  const startSignup = async (phone: string, role: AccountRole): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const sessionId = ensureGuestSessionId();
      
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { 
          action: 'start-signup', 
          phone, 
          account_role: role, 
          channel: 'web_chat', // ✅ Unified channel across all layers
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'حدث خطأ أثناء إرسال الكود.',
          error_code: data?.error_code,
        };
      }

      console.log('[usePortalAuth] ✅ startSignup success, masked:', data.masked_phone);
      return {
        ok: true,
        masked_phone: data.masked_phone,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ startSignup error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify signup OTP and create account
   */
  const verifySignup = async (phone: string, otpCode: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const sessionId = ensureGuestSessionId();
      
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { 
          action: 'verify-signup', 
          phone, 
          otp_code: otpCode, 
          channel: 'web_chat', // ✅ Unified channel across all layers
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'حدث خطأ أثناء إنشاء الحساب.',
          error_code: data?.error_code,
        };
      }

      // Call handleAuthSuccess internally
      handleAuthSuccess(data);
      
      console.log('[usePortalAuth] ✅ verifySignup success, customer:', data.customer_id, 'redirect_url:', data.redirect_url?.slice(0, 60));
      return {
        ok: true,
        customer_id: data.customer_id,
        student_portal_token: data.student_portal_token,
        redirect_url: data.redirect_url || data.action_link,
        account_role: data.account_role,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ verifySignup error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Link email + password to existing customer via portal-auth
   * This creates a Supabase Auth user linked to the customer
   */
  const linkEmailPassword = async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      // Get student_portal_token from localStorage
      const studentPortalToken = localStorage.getItem('student_portal_token');
      
      if (!studentPortalToken) {
        return {
          ok: false,
          error: 'لم يتم العثور على رمز الجلسة',
          error_code: 'server_error',
        };
      }

      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { 
          action: 'link_email_password', 
          email, 
          password,
          student_portal_token: studentPortalToken,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'فشل ربط الإيميل وكلمة المرور',
          error_code: data?.error_code,
        };
      }

      console.log('[usePortalAuth] ✅ linkEmailPassword success');
      return { ok: true };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ linkEmailPassword error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Start student activation — sends OTP to phone for social/email users
   * portal_customer_map is the source of truth; profiles.activation_status is cache only
   */
  const startActivation = async (phone: string): Promise<AuthResult & { already_activated?: boolean }> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return { ok: false, error: 'No active session', error_code: 'server_error' };
      }

      const sessionId = ensureGuestSessionId();
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: {
          action: 'start_student_activation',
          phone,
          supabase_user_id: session.user.id,
          channel: 'web_chat',
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'فشل إرسال رمز التفعيل',
          error_code: data?.error_code,
        };
      }

      console.log('[usePortalAuth] ✅ startActivation success');
      return {
        ok: true,
        masked_phone: data.masked_phone,
        already_activated: data.already_activated,
        customer_id: data.customer_id,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ startActivation error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify student activation — binds phone to social/email user via CRM
   * Collision checks enforced server-side in portal-auth edge function
   */
  const verifyActivation = async (phone: string, otpCode: string): Promise<AuthResult & { activated?: boolean }> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        return { ok: false, error: 'No active session', error_code: 'server_error' };
      }

      const sessionId = ensureGuestSessionId();
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: {
          action: 'verify_student_activation',
          phone,
          otp_code: otpCode,
          supabase_user_id: session.user.id,
          channel: 'web_chat',
          guest_session_id: sessionId,
        },
      });

      if (error || !data?.ok) {
        return {
          ok: false,
          error: data?.error || error?.message || 'فشل التحقق من رمز التفعيل',
          error_code: data?.error_code,
        };
      }

      console.log('[usePortalAuth] ✅ verifyActivation success, customer:', data.customer_id);
      return {
        ok: true,
        activated: data.activated,
        customer_id: data.customer_id,
      };
    } catch (err: any) {
      console.error('[usePortalAuth] ❌ verifyActivation error:', err);
      return { ok: false, error: err.message || 'حدث خطأ غير متوقع' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if current user needs phone activation
   * Returns true if user has a Supabase session but NO portal_customer_map linkage
   */
  const checkNeedsActivation = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;

      // Institution accounts don't need phone activation
      const userMeta = session.user.user_metadata;
      if (userMeta?.account_type === 'institution') return false;

      // Check portal_customer_map — the operational source of truth
      const { data: mapping } = await supabase
        .from('portal_customer_map')
        .select('crm_customer_id')
        .eq('portal_auth_user_id', session.user.id)
        .maybeSingle();

      // If mapping exists, user is activated
      if (mapping?.crm_customer_id) return false;

      // Check if the user came from phone-first auth (already has CRM link via fakeEmail)
      const email = session.user.email || '';
      if (email.endsWith('@phone.auth.portal')) return false;

      // Social/email user without CRM link → needs activation
      console.log('[usePortalAuth] 🔔 User needs phone activation:', session.user.id);
      return true;
    } catch (err) {
      console.error('[usePortalAuth] ❌ checkNeedsActivation error:', err);
      return false;
    }
  };

  return {
    isLoading,
    continueAsGuest,
    startLogin,
    verifyLogin,
    startSignup,
    verifySignup,
    linkEmailPassword,
    handleAuthSuccess,
    startActivation,
    verifyActivation,
    checkNeedsActivation,
  };
}
