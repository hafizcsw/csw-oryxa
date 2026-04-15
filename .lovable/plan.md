

# Upgrade Brain Upload Hub — Progressive Illumination + Better Document Design

## What Changes

### 1. Progressive Brain Illumination
The brain will have **8 segments** (regions/lobes) that light up progressively as files are uploaded:
- 0 files: Brain is dim/outline only
- 1 file: One segment glows
- 2 files: Two segments glow
- Up to 8 files: Entire brain is fully illuminated
- Each segment uses animated gradient fills that "breathe" with a soft pulse
- When a file finishes uploading, its corresponding brain segment transitions from pulsing to solid glow with a flash effect

### 2. Better Document Icons
Replace the basic rectangles with more realistic document icons:
- Larger size (60×75 instead of 50×62)
- Rounded page curl in top-right corner with shadow
- Color-coded header bar at the top (different colors for PDF/image/doc types based on file extension)
- Clearer text line placeholders with better spacing
- Larger, more visible status badges (checkmark/spinner/error)
- File extension label shown as a colored chip at the bottom of the document

### 3. Stronger Animations
- **Flow paths**: Thicker animated dashed lines with glowing trail effect, not just thin dashes
- **Data particles**: Multiple particles (3 per active file) flowing in sequence with varying sizes and opacity
- **Brain pulse rings**: Concentric rings that expand outward from the brain when processing (2-3 rings, staggered timing)
- **Connection lines**: Curved Bézier paths with animated gradient stroke instead of flat color
- **Idle state**: Gentle floating/bobbing animation on document icons when not uploading
- **Completion burst**: Small particle explosion when a file registers successfully

### 4. Visual Hierarchy
- Brain center shows a glowing neural network pattern (interconnected dots and lines) instead of simple upload icon
- The neural network nodes light up progressively matching uploaded file count
- Warm golden/amber gradient for the brain (matching the reference image) instead of theme primary color

## Technical Approach

Single file edit: `src/components/documents/CentralUploadHub.tsx`

- Add `getFileType(filename)` helper to determine doc type for color coding
- Refactor `BrainScene` SVG:
  - Define 8 brain segment paths as separate `<path>` elements with individual fill opacity controlled by file count
  - Add `<radialGradient>` with warm amber tones matching reference image
  - Add concentric pulse `<circle>` elements with `<animate>` for expansion
  - Add neural network overlay (small circles + connecting lines) inside brain
- Refactor `MiniDoc` component:
  - Increase dimensions, add colored header bar, file type chip
  - Add floating/bobbing `<animateTransform>` for idle state
- Enhance flow paths:
  - Triple particle system per active path
  - Animated gradient strokes using `<linearGradient>` with `<animate>` on offsets

No new dependencies. Pure SVG animation.

