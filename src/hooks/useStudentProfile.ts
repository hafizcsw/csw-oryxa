import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

import { StageInfo } from '@/types/chat';

// Interface matching CRM's vw_student_portal_profile
export interface StudentPortalProfile {
  customer_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_e164?: string | null;  // ✅ الحقل الذي يرجعه CRM فعلياً
  national_id: string | null;
  city: string | null;
  country: string | null;
  avatar_url: string | null;
  stage: string | null;
  substage: string | null;
  progress: number | null;
  docs_count: number;
  applications_count: number;
  shortlisted_count: number;
  payment_total_required: number;
  payment_total_paid: number;
  shortlisted_programs: string[];
  // 🆕 Stage info from CRM
  stage_info?: StageInfo | null;
  // 🆕 Counts object
  counts?: {
    documents_total: number;
    payments_total: number;
    payments_pending: number;
    applications_shortlisted: number;
    applications_submitted: number;
  };
  // 🆕 Educational fields from CRM (bot-collected)
  citizenship?: string | null;
  preferred_major?: string | null;
  preferred_degree_level?: string | null;
  last_education_level?: string | null;
  budget_usd?: number | null;
  language_preference?: string | null;
  // 🆕 Additional profile fields
  gender?: string | null;
  birth_year?: string | null;
  dob?: string | null;  // 🆕 Full date of birth YYYY-MM-DD
  gpa?: string | null;
  passport_name?: string | null;
  passport_number?: string | null;
  passport_expiry?: string | null;
  // 🆕 Email/Password linking status
  has_login_credentials?: boolean;
  // 🆕 Documents Lock (from CRM)
  docs_locked?: boolean;
  docs_lock_reason?: string | null;
  docs_locked_at?: string | null;
  // 🆕 Profile Lock (from CRM) - separate from docs lock
  profile_locked?: boolean;
  profile_lock_reason?: string | null;
  profile_locked_at?: string | null;
  // 🆕 Avatar updated_at for cache busting
  avatar_updated_at?: string | null;
}

// Legacy interface for backwards compatibility
export interface StudentProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  city: string | null;
  country: string | null;
  avatar_storage_path: string | null;
  student_substage: string | null;
  student_progress: number | null;
}

// Map CRM profile to legacy format for existing components
function mapToLegacyProfile(crmProfile: StudentPortalProfile, userId: string): StudentProfile {
  return {
    user_id: userId,
    full_name: crmProfile.full_name,
    email: crmProfile.email,
    phone: crmProfile.phone,
    national_id: crmProfile.national_id,
    city: crmProfile.city,
    country: crmProfile.country,
    avatar_storage_path: crmProfile.avatar_url,
    student_substage: crmProfile.substage,
    student_progress: crmProfile.progress,
  };
}

export function useStudentProfile() {
  const { t } = useTranslation('common');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [crmProfile, setCrmProfile] = useState<StudentPortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      // Helper: load local profile from Supabase profiles table (fallback for avatar etc.)
      const loadLocalProfile = async (): Promise<StudentProfile> => {
        const { data: localData } = await supabase
          .from('profiles')
          .select('full_name, phone, avatar_storage_path')
          .eq('user_id', userId)
          .maybeSingle();
        return {
          user_id: userId,
          full_name: localData?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || null,
          email: session.user.email || null,
          phone: localData?.phone || session.user.phone || null,
          national_id: null,
          city: null,
          country: null,
          avatar_storage_path: localData?.avatar_storage_path || null,
          student_substage: null,
          student_progress: 0,
        };
      };

      // Call student-portal-api Edge Function to get profile from CRM
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      let res: Response;
      let result: any;
      try {
        res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get_profile' }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        result = await res.json();
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.warn('[useStudentProfile] CRM fetch failed (timeout/network), using local fallback:', fetchErr?.message);
        // Fallback to local profile so avatar etc. still show
        const localProfile = await loadLocalProfile();
        setProfile(localProfile);
        setError(t('hooks.profile.loadFailed'));
        return;
      }

      // Handle API-level errors - still load local profile for avatar
      if (!res.ok || !result.ok) {
        console.error('[useStudentProfile] CRM API error:', result.error);
        const localProfile = await loadLocalProfile();
        setProfile(localProfile);
        setError(result.message || t('hooks.profile.loadFailed'));
        return;
      }

      // Handle case where profile returned but no linked customer
      if (result.data?.error === 'no_linked_customer' || result.data?.success === false) {
        console.warn('[useStudentProfile] ⚠️ No linked customer detected - setting error for UI banner');
        setError('no_linked_customer');
        const localProfile = await loadLocalProfile();
        setProfile(localProfile);
        setCrmProfile(null);
        return;
      }

      // ✅ مسح أي خطأ سابق عند النجاح
      setError(null);

      const crmData = result.data as StudentPortalProfile;
      
      // ✅ P0: Debug logging for verification
      console.log('[PROFILE]', { 
        customer_id: crmData.customer_id,
        dob: crmData.dob,
        docs_locked: crmData.docs_locked,
        docs_lock_reason: crmData.docs_lock_reason,
        profile_locked: crmData.profile_locked,
        profile_lock_reason: crmData.profile_lock_reason,
      });
      
      setCrmProfile(crmData);
      setProfile(mapToLegacyProfile(crmData, userId));

    } catch (err) {
      console.error('[useStudentProfile] Error:', err);
      setError(t('hooks.profile.connectionFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(payload: Partial<StudentPortalProfile>) {
    const startTime = performance.now();
    console.log('[useStudentProfile] 🚀 Starting update_profile with payload:', JSON.stringify(payload, null, 2));
    console.log('[useStudentProfile] 📤 Payload keys:', Object.keys(payload));
    console.log('[useStudentProfile] 📤 DOB value:', payload.dob);
    
    // 🆕 Client-side profile lock guard
    if (crmProfile?.profile_locked) {
      console.warn('[useStudentProfile] ⛔ Profile is locked - blocking update');
      toast({
        title: t('hooks.profile.profileLocked'),
        description: crmProfile.profile_lock_reason || t('hooks.profile.cannotEditNow'),
        variant: "destructive",
      });
      return false;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[useStudentProfile] ❌ No session/token available');
        throw new Error('Not authenticated');
      }

      console.log('[useStudentProfile] 📤 Sending request to student-portal-api...');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error('[useStudentProfile] ⏱️ Request timed out after 10 seconds');
      }, 10000); // 10 second timeout

      let res: Response;
      try {
        res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'update_profile',
            payload,
          }),
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          toast({
            title: t('hooks.profile.requestTimeout'),
            description: t('hooks.profile.serverNotResponding'),
            variant: "destructive",
          });
          return false;
        }
        throw fetchError;
      }
      
      clearTimeout(timeoutId);
      const endTime = performance.now();
      console.log(`[useStudentProfile] ⏱️ Request took ${Math.round(endTime - startTime)}ms`);
      
      const result = await res.json();
      console.log('[useStudentProfile] 📥 Response:', JSON.stringify(result, null, 2));

      if (!res.ok || !result.ok) {
        const errorMsg = result.error || result.message || t('hooks.profile.saveFailed');
        console.error('[useStudentProfile] ❌ Update failed:', errorMsg);
        
        // Error-specific messages
        if (errorMsg.includes('FEATURE_NOT_AVAILABLE') || errorMsg.includes('PGRST202')) {
          toast({
            title: `⚠️ ${t('hooks.profile.savingNotAvailable')}`,
            description: t('hooks.profile.systemNotActive'),
            variant: "destructive",
          });
        } else if (errorMsg.includes('no_linked_customer')) {
          toast({
            title: `⚠️ ${t('hooks.profile.accountIncomplete')}`,
            description: t('hooks.profile.accountNotLinked'),
            variant: "destructive",
          });
        } else {
          toast({
            title: t('hooks.profile.saveFailed'),
            description: `${t('hooks.profile.errorOccurred')}: ${errorMsg}`,
            variant: "destructive",
          });
        }
        return false;
      }

      console.log('[useStudentProfile] ✅ Update successful, reloading profile...');
      
      // Reload profile
      await loadProfile();

      toast({
        title: t('hooks.profile.updated'),
        description: t('hooks.profile.dataUpdatedSuccess'),
      });

      return true;
    } catch (err: any) {
      console.error('[useStudentProfile] ❌ Update error:', err);
      toast({
        title: t('hooks.profile.connectionError'),
        description: err.message || t('hooks.profile.serverConnectionFailed'),
        variant: "destructive",
      });
      return false;
    }
  }

  return { 
    profile, 
    crmProfile,
    loading,
    error,
    refetch: loadProfile,
    updateProfile,
  };
}
