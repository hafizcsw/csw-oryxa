import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, ChevronDown, ChevronUp, Layers, Satellite, Map as MapIcon, Mountain } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";

export interface HousingLocation {
  id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  price_monthly_local: number | null;
  currency_code: string | null;
  is_primary: boolean;
  status: string;
}

interface Props {
  universityName: string;
  universityLogo?: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  geo_source?: string | null;
  city?: string | null;
  countryName?: string | null;
  housingLocations: HousingLocation[];
  isDark?: boolean;
  alwaysExpanded?: boolean;
}

/* ── Tile URLs (same as home page) ── */
const TILES = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  topo: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};

type LayerType = "satellite" | "streets" | "topo";

/* ── Geo source badge ── */
function geoSourceBadge(source: string | null | undefined): { icon: string; label: string; color: string } {
  if (!source) return { icon: "?", label: "unknown", color: "#f59e0b" };
  const s = source.toLowerCase();
  if (s.startsWith("verified") || s === "osm" || s === "google") {
    return { icon: "✓", label: "verified", color: "#10b981" };
  }
  if (s === "city_center" || s === "city_name_inferred" || s.includes("fallback")) {
    return { icon: "~", label: "city center", color: "#f59e0b" };
  }
  return { icon: "✓", label: "estimated", color: "#6b7280" };
}

export function UniversityLocationMap({
  universityName,
  universityLogo,
  geo_lat,
  geo_lon,
  geo_source,
  city,
  countryName,
  housingLocations,
  isDark: isDarkProp,
  alwaysExpanded = false,
}: Props) {
  const { i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = isDarkProp ?? resolvedTheme === "dark";
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayersRef = useRef<L.TileLayer[]>([]);
  const isArabic = i18n.language === "ar";
  const [expanded, setExpanded] = useState(true);
  const [activeLayer, setActiveLayer] = useState<LayerType>("satellite");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const isExpanded = alwaysExpanded || expanded;

  const validHousing = housingLocations.filter(h => h.lat != null && h.lon != null);
  const hasUniCoords = geo_lat != null && geo_lon != null;
  const hasMapPoints = hasUniCoords || validHousing.length > 0;

  const locationText = [city, countryName].filter(Boolean).join(", ");
  const subtitleText = locationText || (isArabic ? "لا تتوفر إحداثيات دقيقة حالياً" : "Precise coordinates are not available yet");
  const badge = geoSourceBadge(geo_source);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const center: [number, number] = hasUniCoords
      ? [geo_lat!, geo_lon!]
      : validHousing.length > 0
        ? [validHousing[0].lat!, validHousing[0].lon!]
        : [20, 0];

    const map = L.map(mapRef.current, {
      center,
      zoom: hasMapPoints ? 14 : 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    mapInstanceRef.current = map;

    // Set initial tiles (satellite by default)
    updateTileLayers(map, "satellite");

    const allPoints: [number, number][] = [];

    // ── University marker ──
    if (hasUniCoords) {
      const uniIcon = L.divIcon({
        className: "",
        iconSize: [52, 52],
        iconAnchor: [26, 52],
        popupAnchor: [0, -52],
        html: `
          <div style="
            width:52px;height:52px;display:flex;align-items:center;justify-content:center;
            background:linear-gradient(135deg, hsl(222 47% 11%), hsl(222 47% 16%));
            border:3px solid ${badge.color};border-radius:50%;
            box-shadow:0 0 20px ${badge.color}44, 0 4px 16px rgba(0,0,0,0.4);
            position:relative;
          ">
            ${universityLogo
              ? `<img src="${universityLogo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" />`
              : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>`
            }
            <div style="
              position:absolute;top:-6px;right:-6px;
              width:18px;height:18px;border-radius:50%;
              background:${badge.color};
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:bold;color:white;
              border:2px solid ${isDark ? '#0f172a' : 'white'};
              box-shadow:0 2px 6px rgba(0,0,0,0.3);
            ">${badge.icon}</div>
            <div style="
              position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);
              width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;
              border-top:12px solid ${badge.color};
            "></div>
          </div>
        `,
      });

      const uniMarker = L.marker([geo_lat!, geo_lon!], { icon: uniIcon }).addTo(map);
      uniMarker.bindPopup(`
        <div style="font-family:system-ui;min-width:200px;padding:6px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            ${universityLogo ? `<img src="${universityLogo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" />` : ""}
            <strong style="font-size:14px;line-height:1.3">${universityName}</strong>
          </div>
          <div style="font-size:12px;color:#666;margin-top:4px">
            📍 ${subtitleText}
          </div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:6px">
            <span style="
              display:inline-flex;align-items:center;gap:3px;
              font-size:10px;padding:2px 8px;border-radius:10px;
              background:${badge.color}22;color:${badge.color};font-weight:600;
            ">${badge.icon} ${badge.label}</span>
          </div>
          ${geo_source ? `<div style="font-size:10px;color:#999;margin-top:4px">${geo_source}</div>` : ""}
        </div>
      `);

      // Pulsing circle around university
      L.circleMarker([geo_lat!, geo_lon!], {
        radius: 22,
        color: badge.color,
        fillColor: badge.color,
        fillOpacity: 0.12,
        weight: 2,
        opacity: 0.5,
      }).addTo(map);

      allPoints.push([geo_lat!, geo_lon!]);
    }

    // ── Housing markers ──
    validHousing.forEach((h, idx) => {
      const pos: [number, number] = [h.lat!, h.lon!];
      allPoints.push(pos);

      const isPrimary = h.is_primary;
      const color = isPrimary ? "#f59e0b" : "#8b5cf6";
      const size = isPrimary ? 40 : 34;

      const dormIcon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
        html: `
          <div style="
            width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
            background:linear-gradient(135deg, ${color}, ${color}dd);
            border:2.5px solid white;border-radius:50%;
            box-shadow:0 0 14px ${color}55, 0 3px 12px rgba(0,0,0,0.3);
          ">
            <svg width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        `,
      });

      const marker = L.marker(pos, { icon: dormIcon }).addTo(map);

      const priceStr = h.price_monthly_local
        ? `${h.price_monthly_local.toLocaleString()} ${h.currency_code || ""}/${isArabic ? "شهر" : "mo"}`
        : "";

      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:180px;padding:6px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:18px">🏠</span>
            <strong style="font-size:13px">${h.name || (isArabic ? `سكن ${idx + 1}` : `Housing ${idx + 1}`)}</strong>
            ${isPrimary ? `<span style="font-size:9px;background:${color};color:white;padding:2px 8px;border-radius:10px;font-weight:600">${isArabic ? "رئيسي" : "Primary"}</span>` : ""}
          </div>
          ${h.address ? `<div style="font-size:11px;color:#666;margin-top:2px">📍 ${h.address}</div>` : ""}
          ${priceStr ? `<div style="font-size:12px;color:${color};font-weight:700;margin-top:6px">💰 ${priceStr}</div>` : ""}
        </div>
      `);

      // Dashed polyline connecting university to housing
      if (hasUniCoords) {
        const polyline = L.polyline([center, pos], {
          color,
          weight: 2.5,
          opacity: 0.7,
          dashArray: "8,10",
        }).addTo(map);

        // Distance label
        const dist = map.distance(L.latLng(center[0], center[1]), L.latLng(pos[0], pos[1]));
        if (dist > 50) {
          const midLat = (center[0] + pos[0]) / 2;
          const midLon = (center[1] + pos[1]) / 2;
          const distText = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
          L.marker([midLat, midLon], {
            icon: L.divIcon({
              className: "",
              iconSize: [60, 20],
              iconAnchor: [30, 10],
              html: `<div style="
                background:${isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)'};
                color:${isDark ? '#e2e8f0' : '#334155'};
                padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;
                text-align:center;white-space:nowrap;
                box-shadow:0 2px 8px rgba(0,0,0,0.2);
                border:1px solid ${isDark ? 'rgba(51,65,85,0.5)' : 'rgba(203,213,225,0.8)'};
              ">📏 ${distText}</div>`,
            }),
          }).addTo(map);
        }
      }
    });

    // Fit bounds
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (hasMapPoints) {
      map.setView(center, 14);
    }

    // Background color
    if (mapRef.current) {
      mapRef.current.style.background = isDark ? "#0f1729" : "#a3c8e8";
    }

    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 600);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayersRef.current = [];
    };
  }, [
    universityName, universityLogo, geo_lat, geo_lon, geo_source,
    city, countryName, housingLocations, isDark, isArabic,
  ]);

  // Update tiles when layer changes (without rebuilding entire map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    updateTileLayers(map, activeLayer);
  }, [activeLayer]);

  function updateTileLayers(map: L.Map, layer: LayerType) {
    tileLayersRef.current.forEach(t => map.removeLayer(t));
    tileLayersRef.current = [];
    if (layer === "satellite") {
      tileLayersRef.current = [
        L.tileLayer(TILES.satellite, { maxZoom: 18 }).addTo(map),
        L.tileLayer(TILES.labels, { maxZoom: 18, opacity: 0.8 }).addTo(map),
      ];
    } else if (layer === "streets") {
      tileLayersRef.current = [L.tileLayer(TILES.streets, { maxZoom: 19 }).addTo(map)];
    } else {
      tileLayersRef.current = [L.tileLayer(TILES.topo, { maxZoom: 17 }).addTo(map)];
    }
  }

  const layerOptions: { key: LayerType; label: string; icon: typeof Satellite }[] = [
    { key: "satellite", label: isArabic ? "قمر صناعي" : "Satellite", icon: Satellite },
    { key: "streets", label: isArabic ? "شوارع" : "Streets", icon: MapIcon },
    { key: "topo", label: isArabic ? "تضاريس" : "Terrain", icon: Mountain },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {!alwaysExpanded && (
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="text-start">
              <h4 className="font-semibold text-sm text-foreground">
                {isArabic ? "الموقع على الخريطة" : "Location Map"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {subtitleText}
                {validHousing.length > 0 && ` • ${validHousing.length} ${isArabic ? "سكن جامعي" : "housing"}`}
              </p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      )}

      {alwaysExpanded && (
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">
              {isArabic ? "الحرم الجامعي والموقع" : "Campus & Location"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {subtitleText}
              {hasUniCoords && (
                <span
                  className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: `${badge.color}18`, color: badge.color }}
                >
                  {badge.icon} {badge.label}
                </span>
              )}
              {validHousing.length > 0 && ` • ${validHousing.length} ${isArabic ? "سكن جامعي" : "housing"}`}
            </p>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="relative">
          {/* Layer switcher */}
          <div className="absolute top-3 right-3 z-[1000]">
            <div className="relative">
              <button
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all"
                style={{
                  background: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)',
                  color: isDark ? '#e2e8f0' : '#334155',
                  border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : 'rgba(203,213,225,0.8)'}`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Layers className="h-3.5 w-3.5" />
                {layerOptions.find(l => l.key === activeLayer)?.label}
              </button>
              {showLayerMenu && (
                <div
                  className="absolute top-full right-0 mt-1 rounded-lg shadow-xl overflow-hidden"
                  style={{
                    background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
                    border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : 'rgba(203,213,225,0.8)'}`,
                    backdropFilter: 'blur(12px)',
                    minWidth: '130px',
                  }}
                >
                  {layerOptions.map(opt => {
                    const Icon = opt.icon;
                    const isActive = activeLayer === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setActiveLayer(opt.key); setShowLayerMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors"
                        style={{
                          background: isActive ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : 'transparent',
                          color: isActive ? '#3b82f6' : (isDark ? '#cbd5e1' : '#475569'),
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div ref={mapRef} className="w-full" style={{ height: 450 }} />

          {!hasMapPoints && (
            <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
              {isArabic
                ? "الخريطة ظاهرة الآن، وسيتم تحديد موقع أدق عند توفر إحداثيات الجامعة أو السكن."
                : "The map is shown now, and will auto-focus once university or housing coordinates are available."}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-border text-xs text-muted-foreground">
            {hasUniCoords && (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: badge.color, border: '2px solid', borderColor: isDark ? '#1e293b' : 'white' }}
                />
                {isArabic ? "الجامعة" : "University"}
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: `${badge.color}22`, color: badge.color }}
                >
                  {badge.icon}
                </span>
              </span>
            )}
            {validHousing.some(h => h.is_primary) && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#f59e0b" }} />
                {isArabic ? "السكن الرئيسي" : "Primary Housing"}
              </span>
            )}
            {validHousing.some(h => !h.is_primary) && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#8b5cf6" }} />
                {isArabic ? "سكن إضافي" : "Additional Housing"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
