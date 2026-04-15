import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Star, Heart, MessageCircle } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface TeacherData {
  id: string;
  name: string;
  avatar: string;
  country: string;
  countryFlag: string;
  rating: number;
  reviewsCount: number;
  studentsCount: number;
  lessonsCount: number;
  priceUsd: number;
  badges: ("super" | "professional")[];
  languagesSpoken: string[];
  descriptionKey: string;
  specialtyKey: string;
  bookedRecently?: number;
}

import { useNavigate } from "react-router-dom";

export function TeacherCard({ teacher, index, onSelect }: { teacher: TeacherData; index: number; onSelect?: (teacher: TeacherData) => void }) {
  const { t } = useLanguage();
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/languages/teacher/${teacher.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="border border-border rounded-2xl bg-card p-5 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Avatar + info column */}
        <div className="flex gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative shrink-0">
            <img
              src={teacher.avatar}
              alt={teacher.name}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-border"
              loading="lazy"
              width={80}
              height={80}
            />
            <img
              src={`https://flagcdn.com/24x18/${teacher.countryFlag}.png`}
              alt={teacher.country}
              className="absolute -bottom-1 -end-1 w-5 h-4 rounded-sm shadow-sm"
              loading="lazy"
            />
          </div>

          {/* Name + badges + details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-foreground text-base">{teacher.name}</h3>
              {teacher.badges.includes("professional") && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {t("languages.teachers.professional")}
                </span>
              )}
              {teacher.badges.includes("super") && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {t("languages.teachers.superTeacher")}
                </span>
              )}
            </div>

            {/* Teaches */}
            <p className="text-xs text-muted-foreground mb-1">
              {t("languages.teachers.teaches")}
            </p>

            {/* Speaks */}
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-medium">{t("languages.teachers.speaks")}</span>{" "}
              {teacher.languagesSpoken.join(", ")}
            </p>

            {/* Description */}
            <p className={cn(
              "text-sm text-foreground/80 leading-relaxed",
              !expanded && "line-clamp-2"
            )}>
              {t(teacher.descriptionKey)}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold text-primary hover:underline mt-1"
            >
              {t("languages.teachers.learnMore")}
            </button>

            {/* In demand badge */}
            {teacher.bookedRecently && teacher.bookedRecently > 3 && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span className="font-semibold text-foreground">{t("languages.teachers.inDemand")}</span>
                {" · "}
                {t("languages.teachers.bookedRecently", { count: teacher.bookedRecently })} 🔥
              </p>
            )}
          </div>
        </div>

        {/* Price + stats + actions column */}
        <div className="sm:w-48 shrink-0 flex flex-col items-end gap-3">
          {/* Favorite */}
          <button
            onClick={() => setLiked(!liked)}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <Heart className={cn("w-5 h-5", liked ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
          </button>

          {/* Price */}
          <div className="text-end">
            <p className="text-xl font-extrabold text-foreground">
              {t("languages.teachers.pricePerLesson", { price: teacher.priceUsd })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("languages.teachers.lessonDuration")}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5 font-bold text-foreground">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              {teacher.rating}
            </span>
            <span>{t("languages.teachers.students", { count: teacher.studentsCount })}</span>
            <span>{t("languages.teachers.lessons", { count: teacher.lessonsCount })}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("languages.teachers.reviews", { count: teacher.reviewsCount })}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full mt-auto">
            <DSButton size="sm" className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700">
              {t("languages.teachers.bookTrial")}
            </DSButton>
            <DSButton variant="outline" size="sm" className="w-full gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              {t("languages.teachers.sendMessage")}
            </DSButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
