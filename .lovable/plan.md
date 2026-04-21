

## الهدف
استبدال تأثير الجسيمات الحالي بتأثير Antigravity الحقيقي: **شبكة (grid) من الخطوط الرفيعة جدًا** التي تتنفس وتتفاعل مع الماوس بموجة لطيفة، مع توهج ناعم في نقاط التقاطع. هذا هو التوقيع البصري الحقيقي لـ antigravity.google — وليس نقاط متناثرة.

## ما يحدث الآن (المشكلة)
`HeroParticleField.tsx` يرسم 140 نقطة بيضاء صغيرة. هذا يشبه "starfield" عام — لا يوجد فيه أي شيء يربطه بـ Antigravity.

## ما سنبنيه فعلًا

### 1) طبقة Grid (الأساس البصري الحقيقي)
- خطوط أفقية + عمودية بمسافة ~64px
- لون أبيض، شفافية منخفضة جدًا (0.04–0.06)
- سمك 1px فعلي (مع DPR scaling)
- نقاط (dots) صغيرة في كل تقاطع — قطر ~1.2px، شفافية أعلى قليلًا (0.10–0.18)

### 2) Mouse Field (التأثير المميز)
هذا أهم شيء وما يجعله "Antigravity":
- نصف قطر تأثير ~220px حول الماوس
- داخل النصف القطر: شفافية الخطوط والنقاط ترتفع تدريجيًا (falloff ناعم)
- النقاط القريبة جدًا تتحرك ~2–4px فقط بعيدًا عن الماوس (إحساس "تنفس" خفيف)
- العودة بطيئة وسلسة (ease ~0.06)

### 3) Idle Breathing
- موجة sine عامة بطيئة جدًا (دورة ~8 ثوانٍ) ترفع/تخفض شفافية الـ grid بـ ±0.01
- هذا يعطي إحساس "حياة" حتى بدون ماوس

### 4) الأداء والـ Accessibility
- Canvas واحد، rAF واحد
- Pause عند `document.hidden`
- `prefers-reduced-motion` → grid ثابت بدون breathing/mouse
- Mobile (`max-width: 640px`) → mouse field معطّل، الـ grid يبقى

### 5) التكامل مع التصميم
- لا تغيير على الـ gradient، النص، صندوق ORYXA
- نفس الموضع: `position: absolute; inset: 0; z-index: 1; pointer-events: none`
- يبقى تحت المحتوى (z-index: 2)

## الملفات

**`src/components/home/HeroParticleField.tsx`** — إعادة كتابة كاملة:
- إزالة منطق الجسيمات المتناثرة
- منطق جديد: رسم grid lines + intersection dots + mouse-reactive opacity field
- نفس الـ API الخارجي (`<HeroParticleField />` بدون props) → لا حاجة لتعديل `HeroSection.tsx`
- config object قابل للتعديل: `gridSpacing`, `lineOpacity`, `dotOpacity`, `mouseRadius`, `mouseOpacityBoost`, `mouseDisplacement`, `breatheAmplitude`, `breatheSpeedSec`

## القيم الابتدائية المقترحة
```
gridSpacing: 64
lineOpacity: 0.05
dotOpacityMin: 0.10, dotOpacityMax: 0.18
mouseRadius: 220
mouseOpacityBoost: 0.12   // يضاف للخطوط/النقاط داخل النصف القطر
mouseDisplacement: 3      // إزاحة dots فقط، خطوط ثابتة
breatheAmplitude: 0.01
breatheSpeedSec: 8
```

## معيار القبول
- بدون ماوس: شبكة هادئة بالكاد مرئية تتنفس ببطء
- مع الماوس: هالة دائرية ناعمة تتبع المؤشر وتُضيء الـ grid محليًا
- لا glow صريح، لا trails، لا نقاط متناثرة
- النص و ORYXA box يبقيان أوضح عنصر

## بعد التنفيذ
لو الـ effect قوي → نخفض `lineOpacity` و `mouseOpacityBoost`.
لو ضعيف → نرفعهما تدريجيًا.

