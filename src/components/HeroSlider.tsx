import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  id: number;
  image_url: string | null;
  alt_text: string | null;
  university_name: string;
  university_slug: string;
  logo_url: string | null;
}

export default function HeroSlider({ locale = 'ar' }: { locale?: string }) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSlides();
  }, [locale]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  async function loadSlides() {
    try {
      const { data, error } = await supabase.functions.invoke('slider-active', {
        body: { locale }
      });
      if (!error && data?.items) {
        setSlides(data.items);
      }
    } catch (e) {
      console.error('[HeroSlider] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function trackClick(slide: Slide, position: number) {
    try {
      const visitorId = localStorage.getItem('visitor_id') || crypto.randomUUID();
      localStorage.setItem('visitor_id', visitorId);
      
      await supabase.functions.invoke('telemetry-capture', {
        body: {
          event_name: 'slider_click',
          visitor_id: visitorId,
          meta: { id: slide.id, position, slug: slide.university_slug }
        }
      });
    } catch (e) {
      console.error('[HeroSlider] Track failed:', e);
    }
  }

  if (loading || slides.length === 0) {
    return (
      <div className="aspect-[16/9] w-full bg-muted animate-pulse rounded-lg" />
    );
  }

  const slide = slides[current];

  return (
    <div className="relative overflow-hidden rounded-lg group">
      <div className="aspect-[16/9] w-full">
        <a 
          href={`/universities/${slide.university_slug}`}
          onClick={() => trackClick(slide, current)}
          className="block w-full h-full relative"
        >
          <img
            src={slide.image_url || slide.logo_url || '/placeholder.svg'}
            alt={slide.alt_text || slide.university_name}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <h3 className="text-white text-2xl font-bold">
              {slide.university_name}
            </h3>
          </div>
        </a>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? 'bg-white w-8' : 'bg-white/50'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
