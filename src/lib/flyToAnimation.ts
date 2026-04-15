/**
 * macOS Genie / Fly-to-Dock Animation
 * Clones the entire card and shrinks it while flying toward the navbar heart.
 * Uses Web Animations API — no external libraries needed.
 */

export interface FlyToOptions {
  /** The element to "fly" (will be cloned as-is) */
  sourceEl: HTMLElement;
  /** Selector or element for the landing target (e.g. navbar heart) */
  target?: string | HTMLElement;
  /** Duration in ms */
  duration?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export function flyToFavorite({
  sourceEl,
  target = '[data-shortlist-target]',
  duration = 750,
  onComplete,
}: FlyToOptions): void {
  const targetEl = typeof target === 'string' 
    ? document.querySelector<HTMLElement>(target) 
    : target;

  if (!targetEl) {
    onComplete?.();
    return;
  }

  // Try to find the parent card for a more dramatic effect
  const cardEl = sourceEl.closest<HTMLElement>('[data-fly-card]') || sourceEl;
  const srcRect = cardEl.getBoundingClientRect();
  const tgtRect = targetEl.getBoundingClientRect();

  // Clone the card
  const clone = cardEl.cloneNode(true) as HTMLElement;
  clone.style.cssText = `
    position: fixed;
    z-index: 99999;
    pointer-events: none;
    left: ${srcRect.left}px;
    top: ${srcRect.top}px;
    width: ${srcRect.width}px;
    height: ${srcRect.height}px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.35);
    will-change: transform, opacity;
    transform-origin: center center;
  `;
  document.body.appendChild(clone);

  // Calculate flight path
  const srcCenterX = srcRect.left + srcRect.width / 2;
  const srcCenterY = srcRect.top + srcRect.height / 2;
  const tgtCenterX = tgtRect.left + tgtRect.width / 2;
  const tgtCenterY = tgtRect.top + tgtRect.height / 2;
  const dx = tgtCenterX - srcCenterX;
  const dy = tgtCenterY - srcCenterY;

  // Arc lift — bigger arc for more drama
  const arcHeight = Math.min(Math.abs(dy) * 0.4, 120);

  const keyframes: Keyframe[] = [
    {
      transform: 'translate(0px, 0px) scale(1)',
      opacity: 1,
      borderRadius: '16px',
    },
    {
      transform: `translate(${dx * 0.3}px, ${dy * 0.15 - arcHeight}px) scale(0.55)`,
      opacity: 0.95,
      borderRadius: '24px',
      offset: 0.3,
    },
    {
      transform: `translate(${dx * 0.7}px, ${dy * 0.6 - arcHeight * 0.3}px) scale(0.25)`,
      opacity: 0.7,
      borderRadius: '50%',
      offset: 0.65,
    },
    {
      transform: `translate(${dx}px, ${dy}px) scale(0.08)`,
      opacity: 0,
      borderRadius: '50%',
    },
  ];

  const animation = clone.animate(keyframes, {
    duration,
    easing: 'cubic-bezier(0.32, 0, 0.15, 1)',
    fill: 'forwards',
  });

  animation.onfinish = () => {
    clone.remove();

    // Pulse the target (navbar heart)
    targetEl.classList.add('animate-shortlist-land');
    setTimeout(() => {
      targetEl.classList.remove('animate-shortlist-land');
    }, 600);

    onComplete?.();
  };
}
