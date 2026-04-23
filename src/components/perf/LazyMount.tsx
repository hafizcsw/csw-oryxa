import { ReactNode, useEffect, useRef, useState } from "react";

interface LazyMountProps {
  children: ReactNode;
  /** Min height reserved before mount to avoid layout shift */
  minHeight?: number | string;
  /** Root margin for early mount before fully visible */
  rootMargin?: string;
  /** Optional className on the wrapper */
  className?: string;
  /** Once mounted, never unmount (default true) */
  keepMounted?: boolean;
}

/**
 * Defers mounting children until the wrapper enters (or nearly enters) the viewport.
 * Drastically reduces initial DOM nodes for long pages with many below-the-fold sections.
 */
export function LazyMount({
  children,
  minHeight = 200,
  rootMargin = "400px 0px",
  className,
  keepMounted = true,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible && keepMounted) return;
    const node = ref.current;
    if (!node) return;

    // SSR / older browser fallback — mount immediately
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (keepMounted) io.disconnect();
          } else if (!keepMounted) {
            setVisible(false);
          }
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin, keepMounted, visible]);

  return (
    <div
      ref={ref}
      className={className}
      style={!visible ? { minHeight } : undefined}
    >
      {visible ? children : null}
    </div>
  );
}
