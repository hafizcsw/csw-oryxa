

## Plan: Widen ORX Analysis Modal & Use Full Space

**Problem**: The modal is locked at `max-w-[440px]` — a narrow column that wastes most of the screen, cramming all information into a tiny strip. On a 1529px viewport, this uses less than 30% of available width.

### Changes to `src/components/programs/ProgramInsightSheet.tsx`

**1. Widen the modal to use available space**
- Change `max-w-[440px]` → `max-w-2xl` (672px) — uses ~44% of the viewport, balanced and readable
- This gives room for proper 2-column layouts inside

**2. Redesign content layout to use the wider space**
- **Scores section**: Main score on the left, sub-scores grid (`grid-cols-4`) on the right — side by side instead of stacked
- **Strengths & Weaknesses**: Already 2-column but now with proper breathing room at the wider width
- **Summary + Future Outlook**: Side by side — summary takes 2/3, outlook takes 1/3
- **Career Paths**: Horizontal wrap with larger badges now that there's room

**3. Fix font sizes — nothing below 11px**
- Remove all `text-[9px]` and `text-[10px]` instances → minimum `text-[11px]`
- Sub-score labels: `text-[11px]`, score values: `text-sm` (14px)
- Section headers: `text-xs` (12px) bold
- Career badges: `text-[11px]`

**4. Better spacing and visual hierarchy**
- Body padding: `px-5 py-4` instead of `px-4 py-3`
- Gap between sections: `space-y-4` instead of `space-y-3`
- Sub-score cards: slightly taller with `py-2.5`

### No changes
- Data fetching, `handleAskOryxa`, chat handoff logic — all stay as-is
- No new locale keys

