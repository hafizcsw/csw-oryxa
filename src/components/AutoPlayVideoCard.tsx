import { useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AutoPlayVideoCardProps {
  testimonial: {
    id: string;
    student_name: string;
    video_url?: string;
    thumbnail_url?: string;
    quote?: string;
  };
  index: number;
}

const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const getInstagramPostId = (url: string): string | null => {
  const match = url.match(/instagram\.com\/(?:p|reel)\/([^/?]+)/);
  return match ? match[1] : null;
};

export const AutoPlayVideoCard = ({ testimonial, index }: AutoPlayVideoCardProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      const muteParam = isMuted ? 1 : 0;
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=${isVisible ? 1 : 0}&mute=${muteParam}&loop=1&playlist=${youtubeId}&controls=1&rel=0&modestbranding=1`;
    }

    // Instagram
    const instagramId = getInstagramPostId(url);
    if (instagramId) {
      return `https://www.instagram.com/p/${instagramId}/embed/`;
    }

    return null;
  };

  const videoUrl = testimonial.video_url;
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null;
  const isYouTube = videoUrl ? getYouTubeVideoId(videoUrl) !== null : false;

  return (
    <div
      ref={cardRef}
      className="animate-fade-in h-full"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="h-full min-h-[340px] overflow-hidden border-2 border-border/50 hover:border-pink-500/50 transition-all duration-300 hover:shadow-2xl group rounded-xl bg-card flex flex-col">
        <div className="relative h-48 flex-shrink-0 bg-muted">
          {isVisible && embedUrl ? (
            <>
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={testimonial.student_name}
              />
              {/* Mute/Unmute button for YouTube */}
              {isYouTube && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all"
                  title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
              )}
            </>
          ) : (
            <img
              src={testimonial.thumbnail_url || '/placeholder.svg'}
              alt={testimonial.student_name}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col justify-center text-center" dir={isRTL ? "rtl" : "ltr"}>
          <h3 className="font-bold text-lg mb-2 group-hover:text-pink-600 transition-colors">
            {testimonial.student_name}
          </h3>
          {testimonial.quote && (
            <p className="text-muted-foreground text-sm line-clamp-3 h-[60px] overflow-hidden leading-relaxed">
              "{testimonial.quote}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
