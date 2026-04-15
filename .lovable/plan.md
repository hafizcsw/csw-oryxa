

## Plan: Fix ORX Analysis Modal — Proper Layout & Live Feel

**Problem**: The modal has excessive unused space, cramped/overlapping elements, and feels static/lifeless. The information hierarchy is poor — scores, text, and sections are awkwardly sized.

### Changes to `src/components/programs/ProgramInsightSheet.tsx`

**1. Fix layout and spacing**
- Change `max-w-[420px]` → `max-w-md` (448px) and set `max-h-[85vh]`
- Replace the single `px-4 py-3` body wrapper with tighter per-section spacing
- Scores section: increase sub-score card size slightly, use `grid-cols-3` on mobile / `grid-cols-4` on wider, add proper internal padding
- Remove tiny 8px/9px/10px font sizes — minimum 11px for readability, section headers 12px

**2. Redesign score visualization**
- Main score: large centered circular badge at top (48×48 rounded-full with score inside, colored border based on score tier)
- Sub-scores: clean horizontal rows instead of grid — icon + label on left, score on right, with a subtle progress-bar-like colored accent
- This eliminates the cramped 4-col grid that wastes vertical space while being unreadable

**3. Improve section hierarchy**
- Add subtle section dividers (`border-b border-border/20`) between major sections
- Strengths/Weaknesses: proper padding, readable 11px text, green/amber left-border accent instead of tiny dots
- Summary: give it breathing room with `py-3`
- Career paths: larger badges with proper padding

**4. Add life/animation**
- Score numbers: `animate-in fade-in` on load
- Sections: staggered fade-in using `animation-delay`
- Main score circle: subtle pulse on first appearance
- Scrollable body with smooth scroll behavior

**5. Fix "Ask Oryxa" button area**
- Make it sticky at bottom with a gradient fade overlay above it
- Full-width gradient button with proper size (`h-10`)

### No changes needed
- Data fetching logic stays the same
- `handleAskOryxa` logic stays (already working)
- ProgramCard Brain icon trigger stays as-is
- No new locale keys (all existing keys reused)

