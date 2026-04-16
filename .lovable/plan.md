

## المشكلة

طبقة القمر الصناعي (`ArcGIS World_Imagery`) صور فقط بدون أسماء مدن. المطلوب إظهار أسماء المدن من **مصدر الخريطة نفسه** وليس نصوص مكتوبة يدوياً.

## الحل

استخدام طبقة **ArcGIS Reference** الرسمية المصممة خصيصاً للعمل فوق `World_Imagery`. هذه الطبقة تحتوي على أسماء المدن والأماكن من مصدر الخريطة نفسه وتظهر تدريجياً مع الزوم بشكل طبيعي.

**ملف: `src/components/home/WorldMapLeaflet.tsx`**

1. إضافة URL جديد في `TILES`:
```
referenceLabels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
```

2. في سطر 568-571، إضافة هذه الطبقة فوق الصور الفضائية:
```typescript
if (activeLayer === "satellite") {
  tileRef.current = [
    L.tileLayer(TILES.satellite, { ...hdTileOptions, maxZoom: 18, className: ... }).addTo(map),
    L.tileLayer(TILES.referenceLabels, { ...hdTileOptions, maxZoom: 18, pane: 'overlayPane' }).addTo(map),
  ];
}
```

هذه طبقة من **نفس مزود الخريطة** (ArcGIS/Esri) — أسماء المدن تظهر وتختفي تلقائياً حسب مستوى الزوم، تماماً مثل Google Maps عند استخدام وضع القمر الصناعي.

## ملف واحد فقط
- `src/components/home/WorldMapLeaflet.tsx`

