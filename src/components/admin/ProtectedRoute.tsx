/**
 * ProtectedRoute — Admin route guard consuming CRM staff authority ONLY.
 * Requires role=super_admin AND access_scope includes Portal.
 */
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { portalInvoke } from "@/api/portalInvoke";
import { scopeIncludesPortal } from "@/types/staff";
import type { AccessScope } from "@/types/staff";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
      if (session) {
        checkAdminStatus();
      } else {
        setIsAdmin(false);
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthed(!!session);
    
    if (session) {
      await checkAdminStatus();
    } else {
      setReady(true);
    }
  }

  async function checkAdminStatus() {
    try {
      const res = await portalInvoke<{
        is_staff: boolean;
        role: string | null;
        access_scope: AccessScope | null;
      }>('resolve_staff_authority');
      
      if (res.ok && res.data) {
        setIsAdmin(
          res.data.is_staff &&
          res.data.role === 'super_admin' &&
          scopeIncludesPortal(res.data.access_scope)
        );
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Admin check error:", error);
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }

  if (!ready) return null;
  if (!isAuthed) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}
