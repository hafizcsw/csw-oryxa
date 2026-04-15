import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface UniversityData {
  name: string;
  city?: string | null;
  logo_url?: string | null;
  website?: string | null;
  annual_fees?: number | null;
  monthly_living?: number | null;
  ranking?: number | null;
  description?: string | null;
}

interface UniversityDataQualityBadgeProps {
  university: UniversityData;
  showLabel?: boolean;
}

export default function UniversityDataQualityBadge({
  university,
  showLabel = false,
}: UniversityDataQualityBadgeProps) {
  // Calculate completeness score
  const fields = [
    university.city,
    university.logo_url,
    university.website,
    university.annual_fees,
    university.monthly_living,
    university.ranking,
    university.description,
  ];

  const filledFields = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
  const totalFields = fields.length;
  const completeness = Math.round((filledFields / totalFields) * 100);

  // Missing fields
  const missingFields: string[] = [];
  if (!university.city) missingFields.push("المدينة");
  if (!university.logo_url) missingFields.push("الشعار");
  if (!university.website) missingFields.push("الموقع");
  if (!university.annual_fees) missingFields.push("الرسوم السنوية");
  if (!university.monthly_living) missingFields.push("تكلفة المعيشة");
  if (!university.ranking) missingFields.push("الترتيب");
  if (!university.description) missingFields.push("الوصف");

  // Determine colors based on completeness
  const getColors = () => {
    if (completeness >= 80) {
      return {
        bg: "bg-emerald-500",
        track: "bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
      };
    }
    if (completeness >= 50) {
      return {
        bg: "bg-amber-500",
        track: "bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
      };
    }
    return {
      bg: "bg-red-500",
      track: "bg-red-500/20",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/30",
    };
  };

  const colors = getColors();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
            "bg-card border shadow-sm cursor-help",
            colors.border
          )}
        >
          {/* Circular Progress */}
          <div className="relative w-7 h-7">
            <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                strokeWidth="4"
                className={colors.track}
                stroke="currentColor"
              />
              {/* Progress circle */}
              <motion.circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                className={colors.bg}
                stroke="currentColor"
                initial={{ strokeDasharray: "0 88" }}
                animate={{ strokeDasharray: `${(completeness / 100) * 88} 88` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            
            {/* Percentage text inside circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-[9px] font-bold", colors.text)}>
                {completeness}
              </span>
            </div>
          </div>
          
          {showLabel && (
            <span className={cn("text-xs font-medium", colors.text)}>
              {completeness >= 80 ? "مكتمل" : completeness >= 50 ? "جزئي" : "ناقص"}
            </span>
          )}
        </motion.div>
      </TooltipTrigger>
      
      <TooltipContent side="left" className="max-w-xs p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold">اكتمال البيانات</p>
            <span className={cn("text-sm font-bold", colors.text)}>{completeness}%</span>
          </div>
          
          {/* Mini progress bar */}
          <div className={cn("h-2 rounded-full overflow-hidden", colors.track)}>
            <motion.div
              className={cn("h-full rounded-full", colors.bg)}
              initial={{ width: 0 }}
              animate={{ width: `${completeness}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          
          <p className="text-xs text-muted-foreground">
            {filledFields} من {totalFields} حقول مكتملة
          </p>
          
          {missingFields.length > 0 && (
            <div className="text-xs pt-2 border-t">
              <p className="font-medium mb-1.5 text-destructive">الحقول الناقصة:</p>
              <div className="flex flex-wrap gap-1">
                {missingFields.map((field) => (
                  <span 
                    key={field}
                    className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded text-[10px]"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
