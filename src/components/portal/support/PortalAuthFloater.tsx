import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FloatingSupportLauncher } from "./FloatingSupportLauncher";

const PORTAL_PATH_RE = /^\/(account|messages|student-portal)(\/|$)/;

/**
 * Mounts the floating support launcher only when:
 *  1) the user is authenticated
 *  2) the current path is a portal/authenticated route
 *
 * Lives once at the App level (no route refactor required).
 */
export function PortalAuthFloater() {
  const { pathname } = useLocation();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setAuthed(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onPortalRoute = PORTAL_PATH_RE.test(pathname);
  if (!authed || !onPortalRoute) return null;

  return <FloatingSupportLauncher />;
}
