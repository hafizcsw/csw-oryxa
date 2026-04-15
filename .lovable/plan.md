

## Plan: Hide redundant university info on program cards inside university page

**Problem**: When viewing programs inside a university page, the ProgramCard redundantly shows the university name and logo — the student already knows which university they're browsing.

**Solution**: Add a `compact` prop to `ProgramCard` that hides the university name and logo, and use it from `UniversityDetails.tsx`.

### Changes

**1. `src/components/ProgramCard.tsx`**
- Add optional `compact?: boolean` prop to `ProgramCard`
- When `compact` is true:
  - Hide the university name line (MapPin + `displayUniversityName`, lines 258-261)
  - Hide the university logo/avatar (lines 266-271)
  - Keep city + country display (line 262-263) since that's still useful context
  - Adjust layout (remove `gap-3` flex since no logo on the right)

**2. `src/pages/UniversityDetails.tsx`**
- Pass `compact` to ProgramCard on line 699:
  ```tsx
  <ProgramCard key={program.id} p={cardData} compact />
  ```

### What stays visible in compact mode
- Program name
- City + Country
- Fees, duration, language, study mode, intake, scholarships, badges
- ORX Analysis button

### What gets hidden
- University name with MapPin icon
- University logo avatar

No new locale keys needed. No data model changes.

