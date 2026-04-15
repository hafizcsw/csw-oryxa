

## Plan: Redesign ORX Analysis Modal — Clean, World-Class UI

**Problem**: The current ORX Analysis modal looks broken — plain styling, awkward spacing, inconsistent score card colors, and lacks visual polish.

### Changes

**1. `src/components/programs/ProgramInsightSheet.tsx` — Full redesign**

- **Header**: Clean minimal header with subtle gradient, ORX logo mark, program name, and an `X` close button. No heavy color blocks.
- **Score layout**: Replace the current grid with a clean circular/radial design for the main score, surrounded by 8 sub-scores in a compact 4×2 grid with consistent neutral backgrounds and colored score text only.
- **Score cards**: White/card background with subtle borders. Icon + label + score. No heavy colored backgrounds — only the score number gets color treatment (green ≥7, amber ≥4, red <4).
- **Main execution score**: Large prominent display at top-right of the signals section — clean pill with the score.
- **Discipline Future Strength**: Inline row below the grid, subtle border, not a heavy colored block.
- **Summary section**: Clean card with subtle background, proper text spacing.
- **Future Outlook**: Minimal inline display with trend icon.
- **Strengths/Weaknesses**: Two-column layout with clean bullet lists, no heavy colored section headers.
- **Career paths**: Horizontal badges with clean outline style.
- **Best fit**: Subtle info card.
- **"Ask Oryxa" CTA**: Gradient primary button at bottom, full width, with chat icon.
- **Overall**: `max-w-lg` (narrower, focused), proper `rounded-2xl`, clean shadows, consistent `gap` and `padding`.

**2. `src/components/ProgramCard.tsx` — Brain icon trigger refinement**

- Keep the Brain icon button but refine: slightly smaller (w-7 h-7), positioned cleanly at bottom-right of card footer.
- Add a subtle pulse animation on hover for the icon glow effect.
- Remove the full-width border-t footer — integrate the Brain icon into the tags/badges row or float it at the card corner.

### What stays the same
- Data fetching logic (program_ai_snapshots + program_orx_signals)
- "Ask Oryxa" chat handoff logic
- All locale keys (no new hardcoded text)
- Generate/retry flow for missing data

### Design principles
- Neutral backgrounds, color only for score values
- Consistent spacing (p-5, gap-4)
- Typography hierarchy: section headers 12px bold, content 11-12px regular
- No heavy gradients or colored blocks — subtle borders and shadows only

