import { User, Heart, Briefcase, CreditCard, ClipboardCheck, FileText, Plane, Ticket, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SidebarProgressBarProps {
  progress: number; // 0-100
  currentStep: number; // 1-9
}

const STEPS = [
  { number: 1, title: "الحساب", icon: User, color: "hsl(142, 76%, 36%)" },
  { number: 2, title: "البرنامج", icon: Heart, color: "hsl(173, 80%, 40%)" },
  { number: 3, title: "الخدمات", icon: Briefcase, color: "hsl(199, 89%, 48%)" },
  { number: 4, title: "الدفع", icon: CreditCard, color: "hsl(221, 83%, 53%)" },
  { number: 5, title: "التسجيل", icon: ClipboardCheck, color: "hsl(250, 75%, 60%)" },
  { number: 6, title: "القبول", icon: FileText, color: "hsl(271, 81%, 56%)" },
  { number: 7, title: "التأشيرة", icon: Plane, color: "hsl(291, 64%, 52%)" },
  { number: 8, title: "التذاكر", icon: Ticket, color: "hsl(330, 81%, 60%)" },
  { number: 9, title: "الوصول", icon: MapPin, color: "hsl(25, 95%, 53%)" },
];

export function SidebarProgressBar({ progress, currentStep }: SidebarProgressBarProps) {
  const safeStep = Math.min(Math.max(currentStep, 1), 9);
  const currentStepData = STEPS[safeStep - 1];
  const Icon = currentStepData.icon;

  return (
    <div className="py-3 px-2 bg-muted/30 rounded-lg">
      {/* Header: Step info and percentage */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${currentStepData.color}20` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: currentStepData.color }} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground leading-tight">
              {currentStepData.title}
            </span>
            <span className="text-[10px] text-muted-foreground">
              الخطوة {safeStep} من 9
            </span>
          </div>
        </div>
        <span 
          className="text-sm font-bold"
          style={{ color: currentStepData.color }}
        >
          {progress}%
        </span>
      </div>

      {/* Linear Progress Bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 right-0 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${progress}%`,
            background: `linear-gradient(to left, ${currentStepData.color}, ${STEPS[0].color})`
          }}
        />
      </div>
    </div>
  );
}
