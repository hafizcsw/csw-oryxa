import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCountriesWithStats } from "@/hooks/useCountriesWithStats";
import { MapPin, Globe, Users, GraduationCap, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Approximate coordinates for countries by country_code
const COUNTRY_COORDS: Record<string, [number, number]> = {
  AF:[33.93,67.71],AL:[41.15,20.17],DZ:[28.03,1.66],AR:[-38.42,-63.62],
  AM:[40.07,45.04],AU:[-25.27,133.78],AT:[47.52,14.55],AZ:[40.14,47.58],
  BH:[26.07,50.55],BD:[23.68,90.36],BY:[53.71,27.95],BE:[50.5,4.47],
  BA:[43.92,17.68],BR:[-14.24,-51.93],BN:[4.54,114.73],BG:[42.73,25.49],
  CA:[56.13,-106.35],CL:[-35.68,-71.54],CN:[35.86,104.2],CO:[4.57,-74.3],
  HR:[45.1,15.2],CY:[35.13,33.43],CZ:[49.82,15.47],DK:[56.26,9.5],
  EG:[26.82,30.8],EE:[58.6,25.01],FI:[61.92,25.75],FR:[46.23,2.21],
  GE:[42.32,43.36],DE:[51.17,10.45],GR:[39.07,21.82],HK:[22.4,114.11],
  HU:[47.16,19.5],IS:[64.96,-19.02],IN:[20.59,78.96],ID:[-0.79,113.92],
  IR:[32.43,53.69],IQ:[33.22,43.68],IE:[53.41,-8.24],IL:[31.05,34.85],
  IT:[41.87,12.57],JP:[36.2,138.25],JO:[30.59,36.24],KZ:[48.02,66.92],
  KE:[-0.02,37.91],KW:[29.31,47.48],KG:[41.2,74.77],LV:[56.88,24.6],
  LB:[33.85,35.86],LY:[26.34,17.23],LT:[55.17,23.88],LU:[49.82,6.13],
  MY:[4.21,101.98],MT:[35.94,14.38],MX:[23.63,-102.55],MA:[31.79,-7.09],
  NL:[52.13,5.29],NZ:[-40.9,174.89],NG:[9.08,8.68],NO:[60.47,8.47],
  OM:[21.47,55.98],PK:[30.38,69.35],PS:[31.95,35.23],PA:[8.54,-80.78],
  PH:[12.88,121.77],PL:[51.92,19.15],PT:[39.4,-8.22],QA:[25.35,51.18],
  RO:[45.94,24.97],RU:[61.52,105.32],SA:[23.89,45.08],RS:[44.02,21.01],
  SG:[1.35,103.82],SK:[48.67,19.7],SI:[46.15,14.99],ZA:[-30.56,22.94],
  KR:[35.91,127.77],ES:[40.46,-3.75],SE:[60.13,18.64],CH:[46.82,8.23],
  SY:[34.8,38.99],TW:[23.7,120.96],TJ:[38.86,71.28],TH:[15.87,100.99],
  TN:[33.89,9.54],TR:[38.96,35.24],TM:[38.97,59.56],UA:[48.38,31.17],
  AE:[23.42,53.85],GB:[55.38,-3.44],US:[37.09,-95.71],UZ:[41.38,64.59],
  VN:[14.06,108.28],YE:[15.55,48.52],SD:[12.86,30.22],GD:[12.12,-61.67],
  KY:[19.51,-80.57],SN:[14.5,-14.45],TL:[-8.87,125.73],VU:[-15.38,166.96],
  WS:[-13.76,-172.1],SC:[-4.68,55.49],SL:[8.46,-11.78],PF:[-17.68,-149.41],
  BS:[25.03,-77.4],AI:[18.22,-63.07],SR:[3.92,-56.03],VE:[6.42,-66.59],
  BE2:[50.5,4.47],CU:[21.52,-77.78],ET:[9.15,40.49],GH:[7.95,-1.02],
  TZ:[-6.37,34.89],UG:[1.37,32.29],ZW:[-19.02,29.15],MM:[21.91,95.96],
  LA:[19.86,102.5],KH:[12.57,104.99],NP:[28.39,84.12],LK:[7.87,80.77],
  PE:[-9.19,-75.02],EC:[-1.83,-78.18],BO:[-16.29,-63.59],PY:[-23.44,-58.44],
  UY:[-32.52,-55.77],CR:[9.75,-83.75],GT:[15.78,-90.23],HN:[15.2,-86.24],
  SV:[13.79,-88.9],NI:[12.87,-85.21],DO:[18.74,-70.16],JM:[18.11,-77.3],
  TT:[10.69,-61.22],BZ:[17.19,-88.5],GY:[4.86,-58.93],HT:[18.97,-72.29],
};

// Additional global presence markers (not necessarily in DB but show global coverage)
const EXTRA_PRESENCE: Array<{ lat: number; lon: number; label_ar: string; label_en: string }> = [
  { lat: 37.09, lon: -95.71, label_ar: "الولايات المتحدة", label_en: "United States" },
  { lat: -14.24, lon: -51.93, label_ar: "البرازيل", label_en: "Brazil" },
  { lat: 9.08, lon: 8.68, label_ar: "نيجيريا", label_en: "Nigeria" },
  { lat: -0.02, lon: 37.91, label_ar: "كينيا", label_en: "Kenya" },
  { lat: 20.59, lon: 78.96, label_ar: "الهند", label_en: "India" },
  { lat: 36.2, lon: 138.25, label_ar: "اليابان", label_en: "Japan" },
  { lat: 35.91, lon: 127.77, label_ar: "كوريا الجنوبية", label_en: "South Korea" },
  { lat: -30.56, lon: 22.94, label_ar: "جنوب أفريقيا", label_en: "South Africa" },
  { lat: 23.42, lon: 53.85, label_ar: "الإمارات", label_en: "UAE" },
  { lat: 23.89, lon: 45.08, label_ar: "السعودية", label_en: "Saudi Arabia" },
  { lat: 30.38, lon: 69.35, label_ar: "باكستان", label_en: "Pakistan" },
  { lat: 15.87, lon: 100.99, label_ar: "تايلاند", label_en: "Thailand" },
  { lat: 21.91, lon: 95.96, label_ar: "ميانمار", label_en: "Myanmar" },
  { lat: -6.37, lon: 34.89, label_ar: "تنزانيا", label_en: "Tanzania" },
  { lat: 7.95, lon: -1.02, label_ar: "غانا", label_en: "Ghana" },
  { lat: 9.15, lon: 40.49, label_ar: "إثيوبيا", label_en: "Ethiopia" },
];

function WhereWeAreMap({ countries, isAr }: { countries: Array<{ code: string; name_ar: string; name_en: string | null }>; isAr: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Merge DB countries + extra presence into unique pin list
  const pins = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ lat: number; lon: number; label: string }> = [];
    
    for (const c of countries) {
      const coords = COUNTRY_COORDS[c.code];
      if (coords && !seen.has(c.code)) {
        seen.add(c.code);
        result.push({ lat: coords[0], lon: coords[1], label: isAr ? c.name_ar : (c.name_en || c.name_ar) });
      }
    }
    
    for (const e of EXTRA_PRESENCE) {
      const key = `${e.lat.toFixed(1)}_${e.lon.toFixed(1)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ lat: e.lat, lon: e.lon, label: isAr ? e.label_ar : e.label_en });
      }
    }
    
    return result;
  }, [countries, isAr]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      minZoom: 2,
      maxZoom: 6,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    map.fitBounds([[-50, -160], [70, 180]], { padding: [20, 20] });

    // Custom pin icon
    const pinIcon = L.divIcon({
      className: "custom-pin",
      html: `<div style="
        width: 12px; height: 12px; 
        background: hsl(var(--primary)); 
        border: 2px solid white; 
        border-radius: 50%; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse-pin 2s ease-in-out infinite;
      "></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    for (const pin of pins) {
      L.marker([pin.lat, pin.lon], { icon: pinIcon })
        .addTo(map)
        .bindPopup(`<div style="font-family: inherit; font-size: 14px; font-weight: 600; text-align: center; padding: 4px 8px;">${pin.label}</div>`);
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [pins]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl">
      <div ref={mapRef} className="w-full h-[400px] sm:h-[500px] lg:h-[600px]" />
      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-pin {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function WhereWeAre() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { data: countries } = useCountriesWithStats();
  
  const totalCountries = countries?.length || 0;
  const totalUniversities = countries?.reduce((s, c) => s + c.universities_count, 0) || 0;
  const totalPrograms = countries?.reduce((s, c) => s + c.programs_count, 0) || 0;

  const countryList = useMemo(() => 
    (countries || []).map(c => ({ code: c.country_code, name_ar: c.name_ar, name_en: c.name_en })),
    [countries]
  );

  const stats = [
    { icon: Globe, value: `${totalCountries}+`, label: isAr ? "دولة حول العالم" : "Countries Worldwide" },
    { icon: Building2, value: `${totalUniversities.toLocaleString()}+`, label: isAr ? "جامعة شريكة" : "Partner Universities" },
    { icon: GraduationCap, value: `${totalPrograms.toLocaleString()}+`, label: isAr ? "برنامج أكاديمي" : "Academic Programs" },
    { icon: Users, value: "24/7", label: isAr ? "دعم متواصل" : "Continuous Support" },
  ];

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"}>
        {/* Hero */}
        <section className="relative py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <MapPin className="w-4 h-4" />
                {isAr ? "تواجدنا العالمي" : "Our Global Presence"}
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                {isAr ? "أين نحن؟" : "Where We Are"}
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                {isAr 
                  ? "نقدم خدماتنا للطلاب في جميع أنحاء العالم بلا حدود. أينما كنت، نحن هنا لمساعدتك في رحلتك الأكاديمية."
                  : "We serve students across the globe without borders. Wherever you are, we're here to support your academic journey."}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-20 mb-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-card border border-border rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Map */}
        <section className="max-w-7xl mx-auto px-4 mb-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                {isAr ? "خريطة تواجدنا" : "Our Coverage Map"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {isAr
                  ? "كل نقطة على الخريطة تمثل دولة نقدم فيها خدماتنا التعليمية والاستشارية"
                  : "Each pin on the map represents a country where we provide our educational and consulting services"}
              </p>
            </div>
            
            <WhereWeAreMap countries={countryList} isAr={isAr} />
          </motion.div>
        </section>

        {/* Message */}
        <section className="max-w-4xl mx-auto px-4 mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20 rounded-2xl p-8 sm:p-12"
          >
            <Globe className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              {isAr ? "بلا حدود، بلا قيود" : "No Borders, No Limits"}
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              {isAr
                ? "مهمتنا هي جعل التعليم العالمي في متناول الجميع. نعمل مع جامعات في أكثر من " + totalCountries + " دولة لنوفر لك أفضل الفرص الأكاديمية، بغض النظر عن مكانك في العالم."
                : `Our mission is to make global education accessible to everyone. We work with universities in over ${totalCountries} countries to provide you the best academic opportunities, regardless of where you are in the world.`}
            </p>
          </motion.div>
        </section>
      </div>
    </Layout>
  );
}
