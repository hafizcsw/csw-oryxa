/**
 * Particle dash field — full-screen fragment shader.
 * Renders thousands of tiny rounded dashes scattered across the viewport
 * via a hash-grid (jittered cells). Each dash:
 *   - has its own size, orientation, brightness phase
 *   - flickers asynchronously (micro twinkle)
 *   - drifts very slowly
 *   - reacts to the mouse with soft local push + brightness
 *
 * Output is premultiplied RGBA. Color is theme-aware via uTint.
 *   - Light theme: warm multi-hue palette on white
 *   - Dark theme:  cool blue-leaning palette on black
 */

export const vertex = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const fragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;          // 0..1 (y already flipped in JS)
  uniform float uMouseStrength;  // 0..1 smoothed
  uniform float uIntensity;      // overall brightness
  uniform float uDensity;        // cells per shorter-axis unit (e.g. 26..40)
  uniform float uSpeed;          // global time multiplier
  uniform float uMouseRadius;    // 0..1
  uniform float uDashLength;     // dash length in cell units (e.g. 0.32)
  uniform float uDashThickness;  // dash thickness in cell units (e.g. 0.08)
  uniform float uIsDark;         // 1.0 dark theme, 0.0 light theme

  // -------- hash helpers --------
  float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
  vec2  hash22(vec2 p){
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  vec3  hash32(vec2 p){
    vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                  dot(p, vec2(269.5, 183.3)),
                  dot(p, vec2(113.5,  74.7)));
    return fract(sin(q) * 43758.5453);
  }

  // SDF: rounded box (a "dash"), centered at origin, half-extents b, radius r
  float sdRoundBox(vec2 p, vec2 b, float r){
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // Theme-aware color palette per cell
  vec3 cellColor(vec2 cellId){
    vec3 h = hash32(cellId + 17.31);
    if (uIsDark > 0.5) {
      // Cool palette: blues with rare cyan/violet sparks
      vec3 blue   = vec3(0.36, 0.55, 1.00);
      vec3 indigo = vec3(0.45, 0.40, 0.95);
      vec3 cyan   = vec3(0.55, 0.85, 1.00);
      vec3 base   = mix(blue, indigo, h.x);
      base = mix(base, cyan, smoothstep(0.85, 1.0, h.y));
      return base;
    } else {
      // Warm multi-hue palette: blue, violet, magenta, orange (Antigravity light)
      vec3 blue    = vec3(0.20, 0.40, 0.95);
      vec3 violet  = vec3(0.50, 0.30, 0.90);
      vec3 magenta = vec3(0.90, 0.25, 0.55);
      vec3 orange  = vec3(0.98, 0.55, 0.20);
      vec3 c = mix(blue, violet,  smoothstep(0.0, 0.45, h.x));
      c     = mix(c,    magenta, smoothstep(0.45, 0.75, h.x));
      c     = mix(c,    orange,  smoothstep(0.75, 1.0,  h.x));
      return c;
    }
  }

  void main(){
    vec2 res = uResolution;
    float aspect = res.x / max(res.y, 1.0);

    // Aspect-correct space: x in [0..aspect], y in [0..1]
    vec2 p = vec2(vUv.x * aspect, vUv.y);

    // Cell grid sized by density (relative to short axis)
    float cellSize = 1.0 / max(uDensity, 1.0);
    vec2 cellP = p / cellSize;

    // Slow global drift so the field is alive
    vec2 drift = vec2(uTime * uSpeed * 0.05, uTime * uSpeed * 0.03);
    cellP += drift;

    // Mouse vector in same aspect space
    vec2 mp = vec2(uMouse.x * aspect, uMouse.y);

    vec3 accumColor = vec3(0.0);
    float accumAlpha = 0.0;

    // 3x3 neighborhood lookup so dashes can extend across cell borders
    vec2 cellIdF = floor(cellP);
    vec2 fcell = fract(cellP);

    for (int oy = -1; oy <= 1; oy++) {
      for (int ox = -1; ox <= 1; ox++) {
        vec2 offs = vec2(float(ox), float(oy));
        vec2 cid  = cellIdF + offs;

        // Per-cell randomness
        vec2  r2  = hash22(cid);                      // jitter inside cell
        vec3  r3  = hash32(cid + 7.0);                // size, angle, phase
        float r1  = hash11(cid.x * 73.1 + cid.y * 19.7); // existence prob

        // ~62% of cells have a dash → not uniform, leaves breathing space
        if (r1 < 0.38) continue;

        // Dash center inside neighbor cell, in current-cell local coords
        vec2 center = offs + r2; // in cell units relative to cellIdF
        vec2 d = fcell - center; // vector from current point to dash center, in cell units

        // Rotation
        float ang = r3.y * 6.28318 + uTime * uSpeed * (0.05 + r3.z * 0.10) * (r3.x > 0.5 ? 1.0 : -1.0);
        float ca = cos(ang), sa = sin(ang);
        vec2 dr = mat2(ca, -sa, sa, ca) * d;

        // Size variance: some long, some short, some tiny
        float sizeJitter = mix(0.55, 1.25, r3.x);
        vec2  half_ext   = vec2(uDashLength, uDashThickness) * sizeJitter;
        float radius     = uDashThickness * sizeJitter;

        // SDF in cell-local units; convert to pixels for AA width
        float sdf = sdRoundBox(dr, half_ext, radius);
        // Approx pixel size of a cell unit
        float pxPerCell = (res.y * cellSize);
        float aa = 1.5 / max(pxPerCell, 1.0);
        float shape = 1.0 - smoothstep(0.0, aa, sdf);

        if (shape <= 0.001) continue;

        // Async micro-flicker per cell
        float phase = r3.z * 6.28318;
        float flick = 0.55 + 0.45 * sin(uTime * (1.2 + r3.y * 2.4) + phase);
        // Occasional twinkle bursts
        float twk   = pow(0.5 + 0.5 * sin(uTime * (0.6 + r3.x * 0.9) + phase * 1.7), 6.0);
        float bright = mix(0.45, 1.0, flick) + twk * 0.4;

        // Mouse influence: extra brightness inside radius
        float md = distance(p, mp);
        float gauss = exp(-(md * md) / (2.0 * uMouseRadius * uMouseRadius));
        bright += gauss * 0.9 * uMouseStrength;

        // Distance-based fade per cell so edges of dashes are soft, not boxy
        float a = shape * clamp(bright, 0.0, 2.2);

        vec3 col = cellColor(cid);

        // Premultiplied accumulation
        accumColor += col * a;
        accumAlpha += a;
      }
    }

    // Soft cap so densest spots don't blow out
    float outA = clamp(accumAlpha, 0.0, 1.0) * uIntensity;
    vec3  outC = accumAlpha > 0.0 ? (accumColor / accumAlpha) : vec3(0.0);

    // Tint multiplier (kept for theme tweaks; default 1,1,1)
    gl_FragColor = vec4(outC * outA, outA);
  }
`;
