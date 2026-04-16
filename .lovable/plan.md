

## الطلب

جعل الشريط الجانبي يتفاعل مع ما يظهر على الخريطة — عند الزوم على دولة تظهر المدن المرئية في الشريط، وعند الاقتراب من مدينة تظهر جامعاتها.

## الخطة

### 1) إضافة callback للـ viewport من WorldMapLeaflet → WorldMapSection

في `WorldMapLeaflet.tsx`:
- إضافة prop جديد `onViewportChange` يُرسل مستوى الزوم الحالي وحدود المنطقة المرئية (`LatLngBounds`)
- ربطه بأحداث `moveend` و `zoomend` على الخريطة

### 2) حالة viewport في WorldMapSection

في `WorldMapSection.tsx`:
- إضافة state جديد `mapViewport` يحتوي على `{ zoom, bounds }`
- عند تلقي تحديث من الخريطة، تحديث هذا الـ state

### 3) حساب المدن المرئية من الـ viewport

- عندما يكون `drillLevel === "country"` والزوم كافٍ (≥5):
  - فلترة `geoEnrichedCities` بحيث تظهر فقط المدن التي إحداثياتها داخل `bounds` المرئية
  - ترتيبها حسب القرب من مركز الشاشة
- عند الاقتراب أكثر (zoom ≥10) والمدن المرئية قليلة (1-2):
  - تحديد المدينة الأقرب لمركز الشاشة وعرض جامعاتها تلقائياً

### 4) تحديث الشريط الجانبي

مستوى الدولة (`drillLevel === "country"`):
- بدلاً من عرض كل المدن دائماً، عرض فقط المدن المرئية في viewport الخريطة
- عند hover على مدينة في الشريط → عرض tooltip بعدد الجامعات (موجود أصلاً كبادج)

مستوى المدينة:
- عند الزوم القريب جداً (≥10) وظهور مدينة واحدة بوضوح → التبديل تلقائياً لعرض جامعات تلك المدينة في الشريط
- مع إمكانية العودة للمدن بالضغط على زر الرجوع

### 5) منع التضارب مع النقر اليدوي

- إذا اختار المستخدم مدينة يدوياً (بالنقر)، يبقى الاختيار ثابتاً ولا يتأثر بالزوم
- فقط عند عدم وجود اختيار يدوي يتفاعل الشريط مع الـ viewport

## التفاصيل التقنية

**ملفان:**
- `src/components/home/WorldMapLeaflet.tsx` — إضافة `onViewportChange` prop + إرسال الأحداث
- `src/components/home/WorldMapSection.tsx` — استقبال viewport + فلترة المدن/الجامعات المرئية

**المنطق الأساسي:**

```typescript
// WorldMapLeaflet — prop جديد
onViewportChange?: (viewport: { zoom: number; bounds: L.LatLngBounds }) => void;

// ربط بالأحداث
map.on('moveend', () => {
  onViewportChange?.({ zoom: map.getZoom(), bounds: map.getBounds() });
});

// WorldMapSection — فلترة المدن المرئية
const visibleCities = useMemo(() => {
  if (!mapViewport || drillLevel !== "country") return geoEnrichedCities;
  return geoEnrichedCities.filter(city => 
    city.city_lat != null && city.city_lon != null &&
    mapViewport.bounds.contains([city.city_lat, city.city_lon])
  );
}, [geoEnrichedCities, mapViewport, drillLevel]);

// تبديل تلقائي للجامعات عند zoom عالي
useEffect(() => {
  if (mapViewport?.zoom >= 10 && visibleCities.length <= 2 && !manualCitySelection) {
    // عرض جامعات أقرب مدينة تلقائياً
  }
}, [mapViewport, visibleCities]);
```

## النتيجة المتوقعة

1. زوم على روسيا → الشريط يعرض المدن الظاهرة فقط (موسكو، سانت بطرسبرغ...)
2. اقتراب أكثر نحو موسكو → الشريط يعرض جامعات موسكو تلقائياً
3. ابتعاد → الشريط يعود لعرض المدن المرئية
4. النقر اليدوي على مدينة يظل يعمل كالمعتاد

