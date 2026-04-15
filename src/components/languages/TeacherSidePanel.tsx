/**
 * TeacherSidePanel — Preply-style side panel with video + info when a teacher is selected.
 */
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { MOHAMED_AMIN_USER_ID } from '@/components/languages/teacherData';
import { Star, X, CalendarDays, MessageCircle, Clock, Play } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { TeacherData } from './TeacherCard';

function getEmbedUrl(url: string): string | null {
  try {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  } catch { return null; }
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

interface Props {
  teacher: TeacherData | null;
  onClose: () => void;
}

export function TeacherSidePanel({ teacher, onClose }: Props) {
  const { t } = useLanguage();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    setVideoUrl(null);
    setPlaying(false);

    const realUserId = teacher.id === 't0' ? MOHAMED_AMIN_USER_ID : teacher.id;
    const loadVideo = async () => {
      const { data } = await supabase
        .from('teacher_intro_videos')
        .select('video_url, video_path')
        .eq('user_id', realUserId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (data) {
        setVideoUrl((data as any).video_path || (data as any).video_url || null);
      }
    };
    loadVideo();
  }, [teacher]);

  return (
    <AnimatePresence>
      {teacher && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed top-0 end-0 h-full w-full sm:w-96 bg-card border-s border-border shadow-2xl z-50 overflow-y-auto lg:relative lg:h-auto lg:w-full lg:rounded-2xl lg:border lg:shadow-lg lg:z-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 end-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video / Avatar area */}
            <div className="relative aspect-[4/3] bg-muted overflow-hidden">
              {videoUrl ? (
                playing ? (
                  isDirectVideo(videoUrl) ? (
                    <video src={videoUrl} autoPlay controls className="w-full h-full object-cover" />
                  ) : (
                    <iframe
                      src={getEmbedUrl(videoUrl) || videoUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Intro Video"
                    />
                  )
                ) : (
                  <button
                    onClick={() => setPlaying(true)}
                    className="w-full h-full relative group"
                  >
                    <img
                      src={teacher.avatar}
                      alt={teacher.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-7 h-7 text-primary-foreground ms-1" />
                      </div>
                    </div>
                  </button>
                )
              ) : (
                <img
                  src={teacher.avatar}
                  alt={teacher.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Info */}
            <div className="p-5 space-y-4">
              {/* Name + rating */}
              <div>
                <h3 className="text-lg font-bold text-foreground">{teacher.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-semibold">{teacher.rating}</span>
                  <span className="text-xs text-muted-foreground">
                    ({t('languages.teachers.reviews', { count: teacher.reviewsCount })})
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{teacher.studentsCount}</p>
                  <p className="text-xs text-muted-foreground">{t('languages.teachers.activeStudents', { defaultValue: 'Students' })}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{teacher.lessonsCount}</p>
                  <p className="text-xs text-muted-foreground">{t('languages.teachers.totalLessons', { defaultValue: 'Lessons' })}</p>
                </div>
              </div>

              {/* Languages */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{t('languages.teachers.speaks')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.languagesSpoken.map((lang, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {t(teacher.descriptionKey)}
              </p>

              {/* Specialty */}
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-1">{t('languages.teachers.specialty', { defaultValue: 'Specialty' })}</p>
                <p className="text-sm text-foreground/80">{t(teacher.specialtyKey)}</p>
              </div>

              {/* CTA buttons */}
              <div className="space-y-2 pt-2">
                <DSButton className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700">
                  <CalendarDays className="w-4 h-4 me-2" />
                  {t('languages.teachers.viewSchedule', { defaultValue: 'View Full Schedule' })}
                </DSButton>
                <DSButton variant="outline" className="w-full">
                  <MessageCircle className="w-4 h-4 me-2" />
                  {t('languages.teachers.sendMessage')}
                </DSButton>
              </div>

              {/* Price */}
              <div className="text-center pt-2 border-t border-border">
                <p className="text-2xl font-extrabold text-foreground">
                  {t('languages.teachers.pricePerLesson', { price: teacher.priceUsd })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('languages.teachers.lessonDuration')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}