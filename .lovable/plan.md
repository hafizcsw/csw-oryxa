

# Upgrade Brain SVG to Realistic Top-View Design

## Problem
The current brain is drawn with crude geometric segments that look nothing like a real brain. The user wants a design matching the reference image: a **top-down view** of a brain with two hemispheres, visible cerebral folds (gyri/sulci), and a clean line-art style with a subtle glow.

## What Changes

### 1. Replace Brain SVG with Realistic Top-Down Brain
- Replace the 8 crude `BRAIN_SEGMENTS` paths with a proper anatomical top-view brain drawn using detailed Bézier curves
- **Left hemisphere**: Outer contour + 5-6 internal fold curves (sulci) showing gyri patterns
- **Right hemisphere**: Mirror of left with its own fold curves
- Central fissure (longitudinal fissure) dividing the two hemispheres
- Brain stem hint at the bottom
- Style: Clean line-art with thin strokes (like the reference image), light purple/lavender fill with subtle gradient, soft glow halo behind

### 2. Progressive Illumination (Preserved but Improved)
- Instead of 8 crude filled segments, the folds themselves will progressively illuminate
- Each fold line transitions from dim to glowing as files are added
- The hemisphere fill opacity increases progressively (0 files = very faint outline, 8 files = fully glowing)
- Sparkle/glow particles appear around lit areas

### 3. Document Icons Matching Reference Image
- Larger, cleaner documents with visible text lines and dark header blocks (matching the reference)
- Page curl effect on the document corners
- Documents positioned on left and right sides (not orbiting)
- Multiple arrow lines from each document's text blocks pointing toward the brain (like the reference shows specific content sections feeding into the brain)

### 4. Flow Lines Matching Reference
- Multiple parallel arrow lines from document sections to the brain (not single curved paths)
- Small dark rectangles on the arrow lines (representing data blocks being transferred, as shown in reference)
- Clean, straight-to-slightly-curved lines with arrowheads
- Animated dash-offset to show data flowing

## Technical Approach

**Single file edit**: `src/components/documents/CentralUploadHub.tsx`

- Replace `BRAIN_SEGMENTS` array with detailed SVG paths for a top-down brain view (left/right hemisphere outlines + internal sulci curves)
- New gradients: soft lavender/purple `radialGradient` for brain fill, matching the reference image's color palette
- Refactor `MiniDoc` component to match reference: larger white documents with dark header blocks, multiple text line placeholders, page curl
- Replace curved Bézier flow paths with multiple parallel horizontal arrows from document sections to brain, with small data-block rectangles on them
- Keep progressive illumination logic but apply to fold lines and fill opacity instead of segments
- Keep neural network overlay, pulse rings, and particle effects

No new dependencies. Pure SVG.

