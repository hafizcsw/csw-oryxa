

# Antigravity-Style Homepage Replication Plan

Goal: replicate the **motion language**, **section design system**, and **information presentation style** of antigravity.google for everything BELOW the hero on `/`. The hero itself stays untouched.

## What We Observed on antigravity.google

**Visual / Design language**
- Pure white background, near-black text (`#0F0F0F`), ultra-minimal chrome
- One single accent: a soft blue particle field (already replicated in `AntigravityParticleField`)
- Display typography: very large, tight-tracked sans-serif (Google Sans / Inter-like), `clamp(48px → 160px)` for section anchors
- Generous vertical breathing room: ~`160–200px` per section
- Soft rounded pills for CTAs (`border-radius: 999px`), no shadows, no gradients
- Cards: soft 1px borders (`#E5E5E5`), `border-radius: 24px`, hover = subtle scale + shadow
- Black-on-white **statement sections** alternating with white **content sections**, plus one **full-black anchor band** with particles before the footer

**Motion language (NO scroll-jacking)**
- Native scroll only. All animation is driven by IntersectionObserver + native CSS transitions — never wheel/touch interception
- Section enter: `opacity 0 → 1` + `translateY(40px → 0)` over `700ms cubic-bezier(.2,.8,.2,1)`, triggered when 15% in view
- Headlines reveal **word-by-word** (stagger 40ms) using a `SplitReveal` component
- Cards in grids enter with stagger (60ms between items)
- Persistent particle field behind the dark anchor band, mouse-reactive
- Sticky section labels (small uppercase tag) that fade as you scroll past

**Information architecture (post-hero)**
1. **Statement section** — one giant sentence, left-aligned, `clamp(40px,6vw,96px)`, 2-line description right-aligned beneath
2. **Feature triptych** — 3 large cards in a row (image/video on top, title + 1-line desc below), staggered reveal
3. **Built-for grid** — 3 large thumbnails with hover overlay revealing a "Watch case" CTA
4. **Dark anchor band** — full-bleed black section with particles, single huge centered headline + 2 CTAs
5. **Footer-anchor** — gigantic display word ("Antigravity"-style) bleeding off the viewport edges, link columns above it

## Implementation Plan

### New shared primitives (`src/components/antigravity/`)
- `AGSection.tsx` — section wrapper with intersection-driven enter animation, optional `tone="light" | "dark"`, configurable max-width and vertical padding
- `AGRevealText.tsx` — splits headline into words/spans and staggers reveal via CSS variable `--i`
- `AGCard.tsx` — rounded-24 card with 1px border, hover lift, optional media slot
- `AGStatement.tsx` — large statement layout (headline + supporting description on the right)
- `AGTriptych.tsx` — responsive 3-column grid with stagger
- `AGAnchorBand.tsx` — full-bleed dark band, embeds existing `AntigravityParticleField`, centered headline + CTA pair
- `AGDisplayAnchor.tsx` — gigantic word that scales with viewport (the footer-anchor pattern)

### New CSS tokens (`src/index.css`)
- `--ag-bg: #FFFFFF`, `--ag-fg: #0F0F0F`, `--ag-border: #E5E5E5`, `--ag-muted: #6B6B6B`
- `--ag-radius: 24px`, `--ag-radius-pill: 999px`
- `--ag-ease: cubic-bezier(.2,.8,.2,1)`
- `@keyframes ag-rise` (translateY+opacity), used by `[data-ag-reveal][data-in="true"]`

### New homepage sections (replace current below-hero stack)
Replace this block in `src/pages/Index.tsx`:

```text
HeroSection
  ↓
AGStatement        (mission line — replaces UniversityCommunitySection intro)
AGTriptych         (3 student-journey pillars: Discover / Decide / Depart)
WorldMapSection    (kept — restyled to AG tone: white bg, no shadows)
AGStatement        ("Built for global students" framing)
AGTriptych         (3 use-case cards: Undergrad / Postgrad / Scholarships)
AboutOryxaSection  (kept — wrapped in AGSection, restyled)
PartnersMarquee    (kept — restyled: grayscale, no card)
AGAnchorBand       (dark band with particles + "Begin your journey" + CTA)
AGDisplayAnchor    ("ORYXA" giant word above footer)
Footer
```

Existing sections kept (`WorldMapSection`, `AboutOryxaSection`, `PartnersMarquee`) get wrapped + lightly restyled — no logic changes. Removed from default stack: `CSWCoinSection`, `MoneyTransferSection`, `WhyChooseUsSection`, `OrxRankSection`, `InstitutionsSection`, `HowItWorksSection` (kept as files; can be re-introduced later — none deleted).

### i18n
- All copy goes through `useLanguage().t()` with new keys under `home.ag.*` added to all 12 locale files
- No hardcoded visible strings — workspace 12-language baseline preserved

### Performance budget
- Animations: `transform` + `opacity` only
- Reveal driven by IntersectionObserver (one observer per section), disconnected after first trigger
- `prefers-reduced-motion`: animations disabled, content visible immediately
- Mobile (≤768px): same reveal but no stagger, single ease, no particle band (static dark band instead)
- No new heavy libraries

### What is NOT in scope
- The hero itself (`HeroSection`) — untouched per instruction
- No scroll-jacking, no GSAP ScrollTrigger pinning, no Lenis/Locomotive
- No background video — generated video stays removed
- No removal of existing section files — only the homepage composition changes

## Deliverables on approval
1. New `src/components/antigravity/` primitives (7 files)
2. CSS tokens + keyframes added to `src/index.css`
3. Rewritten below-hero composition in `src/pages/Index.tsx`
4. Translation keys added across all 12 locale files for new copy
5. Status report: Closed = visual + motion + i18n; Partial = sections that need photo/video assets to feel finished

