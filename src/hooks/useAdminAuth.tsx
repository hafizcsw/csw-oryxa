/**
 * useAdminAuth — Resolves admin authority from CRM staff truth ONLY.
 * Requires role=super_admin AND access_scope includes Portal.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { portalInvoke } from "@/api/portalInvoke";
import { scopeIncludesPortal } from "@/types/staff";
import type { AccessScope } from "@/types/staff";

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const res = await portalInvoke<{
        is_staff: boolean;
        role: string | null;
        access_scope: AccessScope | null;
      }>('resolve_staff_authority');
      
      if (
        res.ok && res.data &&
        res.data.is_staff &&
        res.data.role === 'super_admin' &&
        scopeIncludesPortal(res.data.access_scope)
      ) {
        setIsAdmin(true);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Admin check error:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  return { isAdmin, loading };
}
