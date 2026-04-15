/**
 * TeacherProfilePage — Preply-style dedicated teacher profile.
 * Reads from teacher_public_profiles first, falls back to MOCK_TEACHERS.
 */
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_TEACHERS, MOHAMED_AMIN_USER_ID } from "@/components/languages/teacherData";
import { useRealTeacherAvatars } from "@/hooks/useRealTeacherAvatars";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Star, Heart, MessageCircle, Clock, ArrowLeft, ArrowRight,
  GraduationCap, Play, Shield, ChevronDown, ChevronUp, Globe, BookOpen, Loader2, Award, CheckCircle2
} from "lucide-react";
import { TeacherScheduleEditor } from "@/components/staff/teacher/TeacherScheduleEditor";
import { DSButton } from "@/components/design-system/DSButton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RealProfile {
  display_name: string | null;
  bio: string | null;
  teaching_experience: string | null;
  education: string | null;
  specialty: string | null;
  languages_spoken: string[];
  country: string | null;
  country_code: string | null;
  price_per_lesson: number | null;
  lesson_duration_minutes: number | null;
  avatar_url: string | null;
  teaches_subject: string | null;
  response_time: string | null;
  badges: string[];
  rating: number | null;
  reviews_count: number | null;
  students_count: number | null;
  lessons_count: number | null;
  booked_recently: number | null;
}

export default function TeacherProfilePage() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const teachers = useRealTeacherAvatars(MOCK_TEACHERS);
  const mockTeacher = teachers.find(t => t.id === teacherId);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [realProfile, setRealProfile] = useState<RealProfile | null>(null);
  const [loadingReal, setLoadingReal] = useState(true);

  // Map mock teacher IDs to real user IDs
  const realUserId = teacherId === 't0' ? MOHAMED_AMIN_USER_ID : teacherId;

  useEffect(() => {
    const loadReal = async () => {
      setLoadingReal(true);
      try {
        // Fetch public profile AND latest avatar from profiles table in parallel
        const [pubRes, profileRes] = await Promise.all([
          (supabase as any)
            .from('teacher_public_profiles')
            .select('*')
            .eq('user_id', realUserId)
            .eq('is_published', true)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('avatar_storage_path')
            .eq('user_id', realUserId)
            .maybeSingle(),
        ]);

        const data = pubRes.data;
        const latestAvatarPath = profileRes.data?.avatar_storage_path;

        // Build the freshest avatar URL: profiles table has the latest upload
        const CRM_AVATARS_BASE = "https://hlrkyoxwbjsgqbncgzpi.supabase.co/storage/v1/object/public/avatars";
        let freshAvatarUrl: string | null = null;
        if (latestAvatarPath) {
          freshAvatarUrl = latestAvatarPath.startsWith('http')
            ? latestAvatarPath
            : `${CRM_AVATARS_BASE}/${latestAvatarPath}`;
          freshAvatarUrl = `${freshAvatarUrl}?v=${Date.now()}`;
        } else if (data?.avatar_url) {
          freshAvatarUrl = `${data.avatar_url}?v=${Date.now()}`;
        }

        if (data) {
          setRealProfile({
            display_name: data.display_name,
            bio: data.bio,
            teaching_experience: data.teaching_experience,
            education: data.education,
            specialty: data.specialty,
            languages_spoken: Array.isArray(data.languages_spoken) ? data.languages_spoken : [],
            country: data.country,
            country_code: data.country_code,
            price_per_lesson: data.price_per_lesson,
            lesson_duration_minutes: data.lesson_duration_minutes,
            avatar_url: freshAvatarUrl,
            teaches_subject: data.teaches_subject,
            response_time: data.response_time,
            badges: Array.isArray(data.badges) ? data.badges : [],
            rating: data.rating,
            reviews_count: data.reviews_count,
            students_count: data.students_count,
            lessons_count: data.lessons_count,
            booked_recently: data.booked_recently,
          });
        } else if (freshAvatarUrl) {
          // No published profile but have fresh avatar
          setRealProfile(prev => prev ? { ...prev, avatar_url: freshAvatarUrl } : null);
        }
      } catch (err) {
        console.warn('[TeacherProfilePage] Real profile load failed:', err);
      } finally {
        setLoadingReal(false);
      }
    };
    if (realUserId) loadReal();
  }, [realUserId]);

  // Load video for this specific teacher
  useEffect(() => {
    if (!realUserId) return;
    const loadVideo = async () => {
      const { data } = await supabase
        .from('teacher_intro_videos')
        .select('video_url, video_path')
        .eq('user_id', realUserId)
        .eq('status', 'active')
        .maybeSingle();
      if (data) {
        // video_path stores external links (YouTube/Vimeo), video_url is auto-generated
        setVideoUrl((data as any).video_path || (data as any).video_url || null);
      }
    };
    loadVideo();
  }, [realUserId]);

  // Determine display data: real profile takes priority over mock
  const isReal = !!realProfile;
  const teacher = mockTeacher;

  // If neither real nor mock found
  if (!loadingReal && !teacher && !realProfile) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("languages.teachers.notFound", { defaultValue: "Teacher not found" })}
            </h1>
            <DSButton onClick={() => navigate("/languages")} variant="outline">
              <BackArrow className="w-4 h-4 me-2" />
              {t("languages.teachers.backToList", { defaultValue: "Back to teachers" })}
            </DSButton>
          </div>
        </div>
      </Layout>
    );
  }

  if (loadingReal && !teacher) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Merged display values
  const displayName = realProfile?.display_name || teacher?.name || '';
  const displayAvatar = realProfile?.avatar_url || teacher?.avatar || '';
  const displayCountry = realProfile?.country || teacher?.country || '';
  const displayCountryCode = realProfile?.country_code || teacher?.countryFlag || '';
  const displaySpecialty = realProfile?.specialty || (teacher ? t(teacher.specialtyKey) : '');
  const displayBio = realProfile?.bio || (teacher ? t(teacher.aboutKey) : '');
  const displayExperience = realProfile?.teaching_experience || (teacher ? t(teacher.experienceKey) : '');
  const displayEducation = realProfile?.education || (teacher ? t(teacher.educationKey) : '');
  const displayLanguages = (realProfile?.languages_spoken?.length ? realProfile.languages_spoken : teacher?.languagesSpoken) || [];
  const displayPrice = realProfile?.price_per_lesson ?? teacher?.priceUsd ?? 0;
  const displayDuration = realProfile?.lesson_duration_minutes || 50;
  const displayRating = realProfile?.rating ?? teacher?.rating ?? 5;
  const displayReviewsCount = realProfile?.reviews_count ?? teacher?.reviewsCount ?? 0;
  const displayLessonsCount = realProfile?.lessons_count ?? teacher?.lessonsCount ?? 0;
  const displayBadges = (realProfile?.badges?.length ? realProfile.badges : teacher?.badges) ?? [];
  const displayReviews = teacher?.reviews ?? [];
  const displayRatings = teacher?.lessonRatings ?? { encouragement: 5, clarity: 5, progress: 5, preparation: 5 };
  const displayResponseTime = realProfile?.response_time || teacher?.responseTime || '1h';
  const displayStudentsCount = realProfile?.students_count ?? teacher?.studentsCount ?? 0;
  const displayBookedRecently = realProfile?.booked_recently ?? teacher?.bookedRecently ?? 0;

  const ratingItems = [
    { labelKey: "languages.teachers.rating.encouragement", value: displayRatings.encouragement },
    { labelKey: "languages.teachers.rating.clarity", value: displayRatings.clarity },
    { labelKey: "languages.teachers.rating.progress", value: displayRatings.progress },
    { labelKey: "languages.teachers.rating.preparation", value: displayRatings.preparation },
  ];

  return (
    <Layout>
      <div className="min-h-[80vh] bg-background">
        <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
          {/* Back button */}
          <button
            onClick={() => navigate("/languages")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            {t("languages.teachers.backToList", { defaultValue: "Back to teachers" })}
          </button>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* ═══ LEFT COLUMN — Main content ═══ */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Video hero — only show if video exists */}
              {videoUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative rounded-2xl overflow-hidden bg-muted aspect-video"
                >
                  {playing ? (
                    /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl) ? (
                      <video src={videoUrl} autoPlay controls className="w-full h-full object-cover" />
                    ) : (
                      <iframe
                        src={(() => {
                          const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
                          if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
                          const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
                          if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
                          return videoUrl;
                        })()}
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
                      <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-9 h-9 text-primary-foreground ms-1" />
                        </div>
                      </div>
                    </button>
                  )}
                </motion.div>
              )}

              {/* Teacher identity */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="relative shrink-0">
                  <img src={displayAvatar} alt={displayName} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                  {displayCountryCode && (
                    <img
                      src={`https://flagcdn.com/24x18/${displayCountryCode}.png`}
                      alt={displayCountry}
                      className="absolute -bottom-1 -end-1 w-6 h-4.5 rounded-sm shadow-sm"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{displayName}</h1>
                    {displayBadges.includes("professional") && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                        {t("languages.teachers.professional")}
                      </span>
                    )}
                    {displayBadges.includes("super") && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        {t("languages.teachers.superTeacher")}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {t("languages.teachers.teaches")} · {t("languages.teachers.from", { defaultValue: "from" })} {displayCountry}
                  </p>
                  {displaySpecialty && (
                    <p className="text-sm text-foreground/80 mt-1">{displaySpecialty}</p>
                  )}
                </div>
              </motion.div>

              {/* Teaches badge */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="font-medium">{t("languages.teachers.teaches")}</span>
                <span className="text-primary font-semibold">
                  {t("languages.catalog.russian.name", { defaultValue: "Russian" })}
                </span>
              </div>

              {/* ═══ ABOUT ═══ */}
              {(displayBio || displayExperience || displayEducation) && (
                <section>
                  <h2 className="text-xl font-bold text-foreground mb-3">
                    {t("languages.teachers.aboutMe", { defaultValue: "About me" })}
                  </h2>
                  <div className={cn("text-foreground/80 leading-relaxed", !aboutExpanded && "line-clamp-4")}>
                    <p>{displayBio}</p>
                    {aboutExpanded && (
                      <>
                        {displayExperience && (
                          <>
                            <h3 className="font-bold mt-4 mb-2 text-foreground">{t("languages.teachers.experienceTitle", { defaultValue: "Teaching experience" })}</h3>
                            <p>{displayExperience}</p>
                          </>
                        )}
                        {displayEducation && (
                          <>
                            <h3 className="font-bold mt-4 mb-2 text-foreground">{t("languages.teachers.educationTitle", { defaultValue: "Education" })}</h3>
                            <p>{displayEducation}</p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline mt-2"
                  >
                    {aboutExpanded
                      ? t("languages.teachers.showLess", { defaultValue: "Show less" })
                      : t("languages.teachers.learnMore")}
                    {aboutExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </section>
              )}

              {/* ═══ LANGUAGES SPOKEN ═══ */}
              {displayLanguages.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-foreground mb-3">
                    {t("languages.teachers.iSpeak", { defaultValue: "I speak" })}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {displayLanguages.map((lang, i) => (
                      <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border">
                        <Globe className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{lang}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ═══ LESSON RATINGS ═══ */}
              <section>
                <h2 className="text-xl font-bold text-foreground mb-4">
                  {t("languages.teachers.lessonRating", { defaultValue: "Lesson rating" })}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {ratingItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">
                            {t(item.labelKey, { defaultValue: item.labelKey.split('.').pop() })}
                          </span>
                          <span className="font-bold text-foreground">{item.value}</span>
                        </div>
                        <Progress value={item.value * 20} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ═══ REVIEWS ═══ */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                    <span className="text-3xl font-bold text-foreground">{displayRating}</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("languages.teachers.basedOnReviews", { defaultValue: "Based on {{count}} reviews", count: displayReviewsCount })}
                    </p>
                  </div>
                </div>

                {displayReviews.length > 0 ? (
                  <div className="space-y-4">
                    {displayReviews.map((review) => (
                      <div key={review.id} className="border border-border rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {review.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{review.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.lessonsCount} {t("languages.teachers.lessonsLabel", { defaultValue: "lessons" })} · {review.date}
                            </p>
                          </div>
                          <div className="ms-auto flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {t(review.text)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("languages.teachers.noReviewsYet", { defaultValue: "No reviews yet" })}
                  </p>
                )}
              </section>

              {/* ═══ SCHEDULE / AVAILABILITY ═══ */}
              <div className="-mx-4 lg:mx-0">
                <TeacherScheduleEditor readOnly teacherUserId={teacherId} />
              </div>

              {/* ═══ CERTIFICATES ═══ */}
              <TeacherCertificatesSectionPublic teacherUserId={teacherId} />
            </div>

            {/* ═══ RIGHT COLUMN — Sticky contact sidebar (reflection-only availability) ═══ */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:w-80 shrink-0"
            >
              <div className="lg:sticky lg:top-24 space-y-4">
                {/* Stats + price card */}
                <div className="border border-border rounded-2xl bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                      <span className="text-xl font-bold">{displayRating}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-foreground">{displayLessonsCount}</p>
                      <p className="text-xs text-muted-foreground">{t("languages.teachers.lessonsLabel", { defaultValue: "lessons" })}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-xl font-bold text-foreground">
                        ${displayPrice}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("languages.teachers.lessonDuration")} ({displayDuration} {t("staff.teacher.profile.minutes", { defaultValue: "min" })})
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-1">
                    {t("languages.teachers.reviewsCount", { defaultValue: "{{count}} reviews", count: displayReviewsCount })}
                  </p>

                  <div className="space-y-2.5 mt-5">
                    <DSButton variant="outline" className="w-full gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {t("languages.teachers.sendMessage")}
                    </DSButton>
                    <DSButton
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setLiked(!liked)}
                    >
                      <Heart className={cn("w-4 h-4", liked ? "fill-red-500 text-red-500" : "")} />
                      {t("languages.teachers.saveToFavorites", { defaultValue: "Save to favorites" })}
                    </DSButton>
                  </div>
                </div>

                {/* Suggestion card */}
                <div className="border border-border rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-sm text-foreground/80">
                      {t("languages.teachers.trialGuarantee", { defaultValue: "If this teacher isn't the right fit, you can try another one for free." })}
                    </p>
                  </div>
                </div>

                {/* Response time */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Clock className="w-4 h-4" />
                  {t("languages.teachers.usuallyResponds", { defaultValue: "Usually responds in {{time}}", time: displayResponseTime })}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ═══ Public certificates section (read-only) ═══ */
function TeacherCertificatesSectionPublic({ teacherUserId }: { teacherUserId?: string }) {
  const { t } = useLanguage();
  const [certs, setCerts] = useState<Array<{
    title: string; issuer: string; year_start: number | null;
    year_end: number | null; is_verified: boolean;
  }>>([]);

  useEffect(() => {
    if (!teacherUserId) return;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('teacher_certificates')
        .select('title, issuer, year_start, year_end, is_verified')
        .eq('user_id', teacherUserId)
        .order('year_start', { ascending: false });
      if (data) setCerts(data);
    };
    load();
  }, [teacherUserId]);

  if (certs.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("staff.teacher.certificates.title", { defaultValue: "Certificates" })}
      </h2>
      <div className="space-y-3">
        {certs.map((cert, i) => (
          <div key={i} className="border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              {cert.year_start}{cert.year_end && cert.year_end !== cert.year_start ? ` — ${cert.year_end}` : ''}
            </p>
            <p className="font-semibold mt-0.5">{cert.title}</p>
            {cert.issuer && <p className="text-sm text-muted-foreground">{cert.issuer}</p>}
            {cert.is_verified && (
              <div className="flex items-center gap-1.5 mt-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">
                  {t("staff.teacher.certificates.verified", { defaultValue: "Certificate verified" })}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
