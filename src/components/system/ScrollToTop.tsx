// ═══════════════════════════════════════════════════════════════
// ScrollToTop — resets scroll on route change
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}
