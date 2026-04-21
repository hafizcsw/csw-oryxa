

## الهدف
استبدال `HeroParticleField` (Canvas 2D) بـ **WebGL shader-based atmospheric field** يعتمد على noise-driven motion + mouse disturbance + depth، مذاب تمامًا داخل الـ gradient الحالي. التصميم/الألوان/الـ layout بدون أي تغيير.

## فئة الإيفكت
**Single full-screen fragment shader** (OGL — ~15 KB gz) يرسم حقل بسيط حيًا فوق الخلفية بـ blend mode `screen`/`additive`، بدون particles مرئية، بدون نقاط، بدون شبكة.

## المكتبة
**OGL** — أصغر بكثير من Three.js، يكفي لـ full-screen shader pass.

## الملفات

### 1) ‎`src/components/home/hero-shader/atmosphericFieldShader.ts` (جديد)
- `vertex`: full-screen quad ثابت.
- `fragment`: 
  - 3D simplex noise (مدمج، ~50 سطر GLSL).
  - طبقتان من الـ noise بترددات/سرعات مختلفة → **ميكرو-فليكر غير متزامن**.
  - حقل depth وهمي عبر noise بطيء جدًا (FBM-lite) → إحساس عمق.
  - **Mouse disturbance**: `uMouse` (vec2 في 0..1) مع `uMouseStrength` (smoothed). تشويش soft Gaussian falloff حول الماوس.
  - النتيجة: قناع شفافية أبيض monochrome (RGB=1, A=mask) يتراكب فوق الـ gradient → لا يغير الألوان، يضيف "حياة".
- `uniforms`: `uTime`, `uResolution`, `uMouse`, `uMouseStrength`, `uIntensity`, `uNoiseScale`, `uSpeed`, `uMouseRadius`, `uDepthBoost`.

### 2) ‎`src/components/home/hero-shader/HeroAtmosphericField.tsx` (جديد، يستبدل HeroParticleField)
- يُنشئ OGL `Renderer`, `Program`, `Mesh` (full-screen triangle) داخل canvas.
- `requestAnimationFrame` loop واحد.
- معالجات `pointermove`/`pointerleave` تحدّث `uMouse` + تنعيم `uMouseStrength` (lerp).
- `ResizeObserver` لتحديث الـ resolution + DPR (مقصور على 1.5).
- `document.visibilitychange` → pause.
- `prefers-reduced-motion` → freeze time + disable mouse.
- Mobile (`max-width: 640px`) → mouse معطّل، intensity أخفض.
- **WebGL fallback**: لو `getContext('webgl2'||'webgl')` فشل → render nothing (لا fallback لـ canvas 2D).
- **Two presets** (الـ A/B المطلوبان) يُمرَّران عبر prop `variant`:
  ```ts
  PRESETS = {
    quieter:    { intensity: 0.10, noiseScale: 1.2, speed: 0.06, mouseRadius: 0.22, depthBoost: 0.35 },
    reactive:   { intensity: 0.16, noiseScale: 1.6, speed: 0.10, mouseRadius: 0.30, depthBoost: 0.50 },
  }
  ```
- نفس الـ wrapper styling: `position:absolute; inset:0; z-index:1; pointer-events:none; mix-blend-mode: screen` (للذوبان داخل الـ gradient).

### 3) ‎`src/components/home/HeroSection.tsx` (تعديل سطر واحد)
- استبدال `<HeroParticleField />` بـ `<HeroAtmosphericField variant="quieter" />`.
- أضع متغير `HERO_FIELD_VARIANT` في أعلى الملف لتبديل سهل بين `'quieter'` و `'reactive'`.

### 4) ‎`src/components/home/HeroParticleField.tsx`
- **حذف الملف** (لم يعد مستخدمًا).

## مكان الـ config الموحّد
كل القيم القابلة للتعديل (الـ presets + الثوابت العامة) في رأس `HeroAtmosphericField.tsx` تحت `// === CONFIG ===` block واحد.

## التبعيات
- إضافة: `ogl@^1.0.11` (~15 KB gz).
- لا three، لا @react-three/fiber.

## التوافق مع التصميم
| العنصر | الحالة |
|---|---|
| الـ gradient الأزرق→البنفسجي→البرتقالي | بدون تغيير |
| النص + ORYXA box | بدون تغيير، يبقى z-index: 2 فوق الـ canvas |
| الـ spacing/layout | بدون تغيير |
| الألوان | الـ shader يخرج أبيض monochrome فقط، blend `screen` يحافظ على الـ palette |

## التسليم النهائي
- ملفات مضافة: `hero-shader/atmosphericFieldShader.ts`, `hero-shader/HeroAtmosphericField.tsx`.
- ملف معدّل: `HeroSection.tsx` (سطر import + سطر JSX + ثابت variant).
- ملف محذوف: `HeroParticleField.tsx`.
- التبديل بين A/B = تغيير قيمة `HERO_FIELD_VARIANT` في `HeroSection.tsx`.

## ملاحظة على فيديوهات desktop/mobile
لا أستطيع توليد فيديوهات تلقائيًا. بعد التنفيذ سأطلب منك مراجعة الـ preview على الشاشتين، وسأرسل screenshots عبر المتصفح إن طلبت.

