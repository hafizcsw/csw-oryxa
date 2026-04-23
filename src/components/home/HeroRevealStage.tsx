import { ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * HeroRevealStage
 * -------------------------------------------------------------
 * Antigravity-style sticky reveal between the hero and the next
 * section, WITHOUT scroll-jacking.
 *
 * Now also renders an optional cinematic background video behind the
 * hero — controlled by `feature_settings.hero_reveal_video` (managed
 * from /admin/hero-video). The video opacity rides --rp so it
 * fades in slightly during the reveal and never blocks the chat UI
 * (pointer-events: none, muted, playsInline, preload=metadata).
 */

interface HeroVideoSetting {
  enabled: boolean;
  url: string | null;
}

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
