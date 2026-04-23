import { ReactNode, useEffect, useRef } from "react";

/**
 * HeroRevealStage
 * -------------------------------------------------------------
 * Antigravity-style sticky reveal between the hero and the next
 * section, WITHOUT scroll-jacking.
 *
 * Layout:
 *   <section data-reveal-stage style="height: 200vh">
 *     <div data-reveal-sticky style="position: sticky; top:0; height:100vh">
 *       {hero}            // gets transform: scale + opacity
 *       <div data-reveal-overlay /> // dark veil 0 -> 0.25
 *     </div>
 *     {next}              // translateY(80 -> 0) + opacity(0 -> 1)
 *   </section>
 *
 * Progress 0..1 is derived from scrollY relative to the stage.
 * Updated inside requestAnimationFrame, writes ONE CSS custom
 * property `--rp` on the stage element. All transforms read that
 * variable in CSS — so the JS does no per-element style writes
 * and triggers no layout.
 *
 * On viewport <= 768px we skip the scrub entirely and let CSS
 * reveal the next section with a normal IntersectionObserver
 * fade-in (lighter on mobile, no sticky math).
 */

interface HeroRevealStageProps {
  hero: ReactNode;
  next: ReactNode;
}

export function HeroRevealStage({ hero, next }: HeroRevealStageProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const nextWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const nextWrapper = nextWrapperRef.current;
    if (!stage || !nextWrapper) return;

    // Respect users that opted out of motion.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // ----- Mobile / reduced motion: lightweight fade-in only.
    if (prefersReduced || isMobile) {
      stage.style.setProperty("--rp", "1");
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              nextWrapper.dataset.revealed = "true";
              io.disconnect();
              break;
            }
          }
        },
        { threshold: 0.15 }
      );
      io.observe(nextWrapper);
      return () => io.disconnect();
    }

    // ----- Desktop: scrub via scrollY + rAF.
    let rafId = 0;
    let ticking = false;

    const update = () => {
      ticking = false;
      const rect = stage.getBoundingClientRect();
      // Stage is 200vh; sticky lives in the first 100vh.
      // scroll progress = how far we've scrolled past the top of
      // the stage, normalized over (stageHeight - viewportHeight).
      const vh = window.innerHeight;
      const total = stage.offsetHeight - vh;
      if (total <= 0) {
        stage.style.setProperty("--rp", "1");
        return;
      }
      const scrolled = -rect.top;
      let p = scrolled / total;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;
      stage.style.setProperty("--rp", p.toFixed(4));
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      ref={stageRef}
      data-reveal-stage=""
      className="reveal-stage relative"
      // 200vh so the sticky hero stays for one full screen of scroll.
      style={{ height: "200vh" }}
      aria-hidden={false}
    >
      <div
        data-reveal-sticky=""
        className="reveal-sticky sticky top-0 h-screen w-full overflow-hidden"
      >
        <div className="reveal-hero h-full w-full will-change-transform">
          {hero}
        </div>
        <div
          aria-hidden="true"
          className="reveal-overlay pointer-events-none absolute inset-0 bg-black"
        />
      </div>

      <div
        ref={nextWrapperRef}
        data-reveal-next=""
        className="reveal-next relative z-10 will-change-transform"
      >
        {next}
      </div>
    </section>
  );
}
