// ═══════════════════════════════════════════════════════════════
// RoutePrefetcher — prefetch likely next pages on idle + hover
// ═══════════════════════════════════════════════════════════════
// Eagerly imports the heaviest "likely next" lazy chunks during the
// browser's idle time, so navigation feels instant. Also attaches a
// global pointerover listener that prefetches the chunk for any
// internal <a href="..."> the user hovers.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react';

type Importer = () => Promise<unknown>;

// Lazy importers keyed by route pattern. Add the most-visited routes only.
const ROUTE_IMPORTERS: Array<{ test: (path: string) => boolean; load: Importer }> = [
  // /account: also warm the most-likely first tabs so the page renders instantly.
  { test: (p) => p === '/' || p.startsWith('/account'), load: () => import('@/pages/Account') },
  { test: (p) => p === '/' || p.startsWith('/account'), load: () => import('@/components/portal/account/DashboardOverview') },
  { test: (p) => p === '/' || p.startsWith('/account'), load: () => import('@/components/portal/tabs/StudyFileTab') },
  { test: (p) => p.startsWith('/search') || p.startsWith('/universities'), load: () => import('@/pages/Universities') },
  { test: (p) => p.startsWith('/countries'), load: () => import('@/pages/Countries') },
  { test: (p) => p.startsWith('/country/'), load: () => import('@/pages/Country') },
  { test: (p) => p.startsWith('/university/'), load: () => import('@/pages/UniversityDetails') },
  { test: (p) => p.startsWith('/program/'), load: () => import('@/pages/ProgramDetails') },
  { test: (p) => p.startsWith('/compare'), load: () => import('@/pages/ComparePage') },
  { test: (p) => p.startsWith('/messages'), load: () => import('@/pages/Messages') },
  { test: (p) => p.startsWith('/scholarships'), load: () => import('@/pages/Scholarships') },
  { test: (p) => p.startsWith('/about'), load: () => import('@/pages/About') },
];

const prefetched = new Set<Importer>();

function safeLoad(load: Importer) {
  if (prefetched.has(load)) return;
  prefetched.add(load);
  // Swallow any error — prefetch is best-effort.
  load().catch(() => prefetched.delete(load));
}

function prefetchForPath(path: string) {
  for (const r of ROUTE_IMPORTERS) {
    if (r.test(path)) safeLoad(r.load);
  }
}

export function RoutePrefetcher() {
  useEffect(() => {
    // 1) Idle prefetch: warm up the most common routes.
    const idle = (cb: () => void) => {
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') {
        return w.requestIdleCallback(cb, { timeout: 2500 });
      }
      return window.setTimeout(cb, 1500);
    };
    const cancelIdle = (handle: number) => {
      const w = window as any;
      if (typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
    const handle = idle(() => {
      // Prefetch top routes; skip the page the user is already on.
      const here = window.location.pathname;
      for (const r of ROUTE_IMPORTERS) {
        if (!r.test(here)) safeLoad(r.load);
      }
    });

    // 2) Hover prefetch: when the user hovers any internal anchor, warm its chunk.
    const onPointerOver = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        prefetchForPath(url.pathname);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerover', onPointerOver, { passive: true });

    return () => {
      cancelIdle(handle as number);
      window.removeEventListener('pointerover', onPointerOver);
    };
  }, []);

  return null;
}
