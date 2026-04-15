import { User, Heart, Briefcase, CreditCard, ClipboardCheck, FileText, Plane, Ticket, MapPin } from "lucide-react";

interface SidebarProgressCircleProps {
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

export function SidebarProgressCircle({ progress, currentStep }: SidebarProgressCircleProps) {
  const safeStep = Math.min(Math.max(currentStep, 1), 9);
  const currentStepData = STEPS[safeStep - 1];
  const Icon = currentStepData.icon;
  
  // SVG circle calculations
  const size = 70;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate filled portion based on progress
  const filledLength = (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center py-3 px-2">
      {/* Circle Progress */}
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          
          {/* Gradient progress - render each completed step segment */}
          {STEPS.map((step, index) => {
            const stepPortion = circumference / 9;
            const stepStart = index * stepPortion;
            const stepProgress = Math.min(Math.max((progress - (index * 11.11)) / 11.11, 0), 1);
            
            if (stepProgress <= 0) return null;
            
            return (
              <circle
                key={step.number}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={step.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${stepPortion * stepProgress} ${circumference}`}
                strokeDashoffset={-stepStart}
                className="transition-all duration-500 ease-out"
              />
            );
          })}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{progress}%</span>
        </div>
      </div>
      
      {/* Current step info */}
      <div className="mt-2 flex items-center gap-1.5">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center animate-pulse"
          style={{ backgroundColor: `${currentStepData.color}20` }}
        >
          <Icon className="w-3 h-3" style={{ color: currentStepData.color }} />
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">الخطوة {safeStep}/9</p>
          <p className="text-xs font-medium text-foreground">{currentStepData.title}</p>
        </div>
      </div>
    </div>
  );
}
