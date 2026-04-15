import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApplicationService {
  code: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface StudentApplication {
  id: string;
  application_id: string;  // ✅ CRM application_id (for Case Status linking)
  program_id: string;
  program_name: string;
  university_name: string;
  country: string | null;
  city: string | null;
  degree_level: string | null;
  status: 'shortlisted' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn' | 'pending_payment' | 'in_review' | 'active';
  submitted_at: string | null;
  created_at: string;
  // ✅ NEW: Services and payment fields
  services?: ApplicationService[];
  total_amount?: number;
  currency?: string;
  payment_id?: string;
  payment_status?: 'requested' | 'proof_received' | 'proof_rejected' | 'fully_paid';
  rejection_reason?: string | null;
}

export function useStudentApplications() {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);

  useEffect(() => {
    loadApplications();
    
    // Listen for shortlist updates
    const handleUpdate = () => loadApplications();
    window.addEventListener('shortlist-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('application-submitted', handleUpdate);
    
    return () => {
      window.removeEventListener('shortlist-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('application-submitted', handleUpdate);
    };
  }, []);

  async function loadApplications() {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Only load from CRM - applications are ONLY from CRM (not localStorage)
      if (session?.access_token) {
        try {
          // ✅ Use get_applications (CRM proxy with Portal fallback)
          const portalRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-portal-api`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'get_applications' }),
          });
          
          const portalResult = await portalRes.json();

          if (portalResult.ok && portalResult.data && Array.isArray(portalResult.data)) {
            // Transform Portal DB data to StudentApplication interface
            // ✅ View already joins payment_status from portal_payments_v1
            const portalApps: StudentApplication[] = portalResult.data.map((app: any) => ({
              id: app.id,
              // ✅ CRM application_id - use crm_application_id if available, otherwise fallback to id
              application_id: app.crm_application_id || app.application_id || app.id,
              program_id: app.program_id,
              program_name: app.program_name || 'البرنامج المختار',
              university_name: app.university_name || '',
              country: app.country_code,
              city: null,
              degree_level: null,
              status: app.status as StudentApplication['status'],
              submitted_at: app.created_at,
              created_at: app.created_at,
              services: Array.isArray(app.services_json) ? app.services_json.map((s: any) => ({
                code: s.code,
                name: s.name,
                qty: s.qty,
                unit_price: s.unit_price,
                line_total: s.line_total,
              })) : [],
              total_amount: app.total_amount,
              currency: app.currency,
              payment_id: app.payment_id,
              // ✅ payment_status comes from VIEW join (not hardcoded)
              payment_status: app.payment_status || 'requested',
              rejection_reason: app.rejection_reason,
            }));
            
            setApplications(portalApps);
            setFeatureAvailable(true);
            setLoading(false);
            return;
          }

          if (portalResult.error === 'FEATURE_NOT_AVAILABLE') {
            console.warn('[useStudentApplications] Portal feature not available');
            setFeatureAvailable(false);
          }
        } catch (portalErr) {
          console.warn('[useStudentApplications] Portal call failed:', portalErr);
        }
      }

      // No localStorage fallback - applications only come from CRM
      setApplications([]);
      setFeatureAvailable(true);

    } catch (err) {
      console.error('[useStudentApplications] Error:', err);
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  // Group applications by status (no shortlisted - those go to ShortlistTab)
  const submitted = applications.filter(a => 
    a.status === 'submitted' || a.status === 'under_review'
  );
  const decided = applications.filter(a => 
    a.status === 'accepted' || a.status === 'rejected'
  );
  const pendingPayment = applications.filter(a => 
    a.status === 'pending_payment'
  );
  const active = applications.filter(a => 
    a.status === 'active' || a.status === 'in_review'
  );

  return { 
    applications, 
    loading,
    error,
    featureAvailable,
    submitted,
    decided,
    pendingPayment,
    active,
    refetch: loadApplications,
  };
}
