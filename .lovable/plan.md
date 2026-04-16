

## المشكلة

ثلاث مشاكل في تفاعل الخريطة:

1. **الطرد عند التقريب**: الـ `useEffect` الرئيسي (سطر 773) يعيد تشغيل `fitBounds`/`flyTo` كلما تغيرت أي تبعية (OSM overlay, geo enrichment, إلخ) — مما يعيد ضبط الزوم ويطردك للخلف
2. **التثبيت عند الابتعاد**: لا يوجد ربط بين مستوى الزوم و`drillLevel` — الابتعاد يدوياً لا يغيّر المستوى من "city" إلى "country" أو من "country" إلى "world"
3. **لا تزامن**: الشريط الجانبي والخريطة غير متزامنين عند التنقل

## الحل

### 1. منع إعادة الزوم عند تغييرات غير جوهرية

**ملف: `src/components/home/WorldMapLeaflet.tsx`**

- فصل الـ `useEffect` الكبير إلى جزئين:
  - **جزء الرسم** (markers, borders): يعاد تشغيله مع كل تغيير بيانات
  - **جزء الزوم** (`fitBounds`/`flyTo`): يعاد تشغيله **فقط** عند تغيير `drillLevel` أو `selectedCountryCode` أو `regionCities` — باستخدام `useRef` لتتبع آخر قيم تم الزوم عليها
- إضافة `ref` يحفظ `{ drillLevel, countryCode, regionCities }` — إذا لم تتغير، لا يتم استدعاء `fitBounds`

### 2. إضافة انتقال تلقائي عند الزوم يدوياً

**ملف: `src/components/home/WorldMapLeaflet.tsx`**

- إضافة حدث `zoomend` يتحقق من مستوى الزوم:
  - إذا كان `drillLevel === "region"` (city) والزوم أقل من 8 → استدعاء `onBackToCountry()`
  - إذا كان `drillLevel === "country"` والزوم أقل من 4 → استدعاء `onBackToWorld()`
- إضافة خاصيتين جديدتين للـ props: `onBackToCountry` و `onBackToWorld`

**ملف: `src/components/home/WorldMapSection.tsx`**

- تمرير `handleBackToCountry` و `handleBackToWorld` كـ props للخريطة

### 3. تزامن الشريط الجانبي مع الخريطة

**ملف: `src/components/home/WorldMapSection.tsx`**

- عند النقر على جامعة في الشريط الجانبي، استدعاء `mapLeafletRef.current.flyTo()` (موجود بالفعل)
- عند النقر على "الرجوع" في الشريط الجانبي، تأكد أن الخريطة تعيد الزوم بشكل متزامن (يحدث تلقائياً بعد إصلاح #1)

## التفاصيل التقنية

```text
// Zoom guard ref (prevents re-zoom on non-drill changes)
const lastZoomTarget = useRef({ drillLevel: '', countryCode: '', city: '' });

// In the render effect — only call fitBounds when target actually changed:
const newTarget = `${drillLevel}|${selectedCountryCode}|${regionCities?.join(',')}`;
if (newTarget !== lastZoomTarget.current) {
  lastZoomTarget.current = newTarget;
  // ... fitBounds / flyTo logic here
}

// Zoom-based drill transitions
map.on('zoomend', () => {
  const z = map.getZoom();
  if (drillLevel === 'region' && z < 8) onBackToCountry?.();
  if (drillLevel === 'country' && z < 4) onBackToWorld?.();
});
```

## الملفات المتغيرة
- `src/components/home/WorldMapLeaflet.tsx` — فصل زوم عن رسم + حدث zoomend
- `src/components/home/WorldMapSection.tsx` — تمرير props جديدة

