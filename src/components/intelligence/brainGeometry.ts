// ═══════════════════════════════════════════════════════════════
// Brain geometry — pure vector data (no raster).
// All paths are hand-tuned for the 1600x900 viewBox used by the
// BrainIngestionVisualizer. The silhouette is symmetric around CX.
// ═══════════════════════════════════════════════════════════════

export const VB_W = 1600;
export const VB_H = 900;
export const CX = VB_W / 2;
export const CY = VB_H / 2;

// ── Brain silhouette (closed path, symmetric, technical-feel) ───────
// Drawn as a stylised lateral cerebrum with subtle frontal/occipital
// lobes and a soft underside (brainstem omitted for cleanliness).
export const BRAIN_SILHOUETTE_D = `
  M 800 230
  C 920 220, 1020 250, 1090 300
  C 1170 340, 1230 400, 1250 470
  C 1268 540, 1248 600, 1200 640
  C 1170 670, 1120 685, 1060 685
  C 1020 720, 950 735, 870 730
  C 830 745, 770 745, 730 730
  C 650 735, 580 720, 540 685
  C 480 685, 430 670, 400 640
  C 352 600, 332 540, 350 470
  C 370 400, 430 340, 510 300
  C 580 250, 680 220, 800 230
  Z
`;

// ── Central seam (longitudinal fissure) ─────────────────────────────
export const BRAIN_SEAM_D = `
  M 800 232
  C 798 320, 802 410, 800 500
  C 798 590, 802 670, 800 728
`;

// ── Internal wireframe — the "technical" feel (sulci/gyri stylised) ─
// Each path is a short curve hinting at a fold. Mirrored entries are
// generated automatically (left side here, mirroring at runtime).
export const BRAIN_WIREFRAME_LEFT: string[] = [
  // Frontal lobe folds
  "M 540 320 C 590 310, 640 320, 690 340",
  "M 520 370 C 580 360, 650 370, 710 390",
  "M 510 420 C 580 415, 660 425, 730 440",
  // Parietal folds
  "M 500 470 C 580 465, 670 475, 760 485",
  "M 510 520 C 590 515, 680 520, 770 530",
  // Temporal lobe arc (lower)
  "M 530 580 C 600 590, 680 600, 760 605",
  "M 560 625 C 620 640, 690 650, 760 655",
  // Occipital fold (back)
  "M 410 540 C 440 555, 470 565, 510 570",
  "M 400 490 C 430 500, 470 505, 510 510",
  // Diagonal cross-folds (technical accent)
  "M 580 340 C 620 400, 660 460, 700 520",
  "M 620 360 C 650 420, 680 480, 720 540",
];

// Mirror an SVG path's x-coordinates around VB_W (parity-aware: x then y).
export function mirrorPathX(d: string, width: number = VB_W): string {
  let isX = true; // M/L/C absolute commands all start with x
  return d.replace(/-?\d+(?:\.\d+)?/g, (num) => {
    const v = parseFloat(num);
    const out = isX ? width - v : v;
    isX = !isX;
    return String(out);
  });
}

export const BRAIN_WIREFRAME_RIGHT: string[] = BRAIN_WIREFRAME_LEFT.map((d) =>
  mirrorPathX(d),
);

// ── Internal fill regions (paths inside the silhouette) ─────────────
// 7 regions, ordered to match REGION_THRESHOLDS in the hook.
// They are drawn as broad shapes that, when clipped to the silhouette,
// fill anatomically-plausible zones.
export const REGION_PATHS: Record<string, string> = {
  "left-lower": "M 360 600 L 800 600 L 800 740 L 360 740 Z",
  "right-lower": "M 800 600 L 1240 600 L 1240 740 L 800 740 Z",
  "left-mid": "M 360 460 L 800 460 L 800 600 L 360 600 Z",
  "right-mid": "M 800 460 L 1240 460 L 1240 600 L 800 600 Z",
  "left-upper": "M 360 220 L 800 220 L 800 460 L 360 460 Z",
  "right-upper": "M 800 220 L 1240 220 L 1240 460 L 800 460 Z",
  "core-seam": "M 770 220 L 830 220 L 830 740 L 770 740 Z",
};

export const REGION_ORDER = [
  "left-lower",
  "right-lower",
  "left-mid",
  "right-mid",
  "left-upper",
  "right-upper",
  "core-seam",
] as const;

// ── External conduits (data branches) ───────────────────────────────
// 9 paths per side, three tiers (outer/mid/terminal). All flow inward
// toward the brain silhouette perimeter (~x=350 on the left).
export type Branch = {
  id: string;
  d: string;
  side: "left" | "right";
  tier: "outer" | "mid" | "terminal";
};

const LEFT_BRANCH_DATA: Array<Omit<Branch, "side" | "id">> = [
  // OUTER — long sweeps from the file source toward mid-zone
  { tier: "outer", d: "M 90 200 C 200 220, 280 260, 340 290" },
  { tier: "outer", d: "M 70 320 C 180 330, 260 340, 330 360" },
  { tier: "outer", d: "M 60 440 C 170 440, 250 440, 330 440" },
  { tier: "outer", d: "M 70 560 C 180 550, 260 540, 330 520" },
  { tier: "outer", d: "M 90 680 C 200 660, 280 620, 340 590" },
  // MID — feed terminal joints
  { tier: "mid", d: "M 200 250 C 260 270, 300 300, 340 320" },
  { tier: "mid", d: "M 200 630 C 260 600, 300 580, 340 560" },
  // TERMINAL — short bridges to silhouette perimeter
  { tier: "terminal", d: "M 340 290 C 360 300, 380 305, 400 305" },
  { tier: "terminal", d: "M 340 590 C 360 585, 380 580, 400 575" },
];

export const BRANCHES: Branch[] = [
  ...LEFT_BRANCH_DATA.map((b, i) => ({
    ...b,
    id: `L-${i}`,
    side: "left" as const,
  })),
  ...LEFT_BRANCH_DATA.map((b, i) => ({
    ...b,
    id: `R-${i}`,
    side: "right" as const,
    d: mirrorPathX(b.d),
  })),
];

// ── Branch nodes (real circles at joints / endpoints) ───────────────
export type BranchNode = {
  x: number;
  y: number;
  tier: "mid" | "terminal";
  side: "left" | "right";
};

const LEFT_NODES: Array<Omit<BranchNode, "side">> = [
  { x: 200, y: 250, tier: "mid" },
  { x: 200, y: 630, tier: "mid" },
  { x: 340, y: 290, tier: "mid" },
  { x: 340, y: 360, tier: "mid" },
  { x: 340, y: 440, tier: "mid" },
  { x: 340, y: 520, tier: "mid" },
  { x: 340, y: 590, tier: "mid" },
  { x: 400, y: 305, tier: "terminal" },
  { x: 400, y: 575, tier: "terminal" },
];

export const BRANCH_NODES: BranchNode[] = [
  ...LEFT_NODES.map((n) => ({ ...n, side: "left" as const })),
  ...LEFT_NODES.map((n) => ({ ...n, side: "right" as const, x: VB_W - n.x })),
];

// ── Entry bridges — terminal → silhouette perimeter (real paths) ────
export const ENTRY_BRIDGES: Array<{ d: string; side: "left" | "right" }> = [
  { side: "left", d: "M 400 305 C 440 310, 480 310, 520 308" },
  { side: "left", d: "M 400 575 C 440 572, 480 572, 520 570" },
  { side: "right", d: mirrorPathX("M 400 305 C 440 310, 480 310, 520 308") },
  { side: "right", d: mirrorPathX("M 400 575 C 440 572, 480 572, 520 570") },
];

// ── File node positions ─────────────────────────────────────────────
export const FILE_LEFT = { x: 60, y: 440 };
export const FILE_RIGHT = { x: VB_W - 60, y: 440 };
