import { Check, User, GraduationCap, Settings, CreditCard, FileCheck, FileText, Stamp, Plane, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface JourneyStepsFixedProps {
  currentStep?: number;
  crmSubstage?: string | null;
}

interface Step {
  id: string;
  number: number;
  title: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  { id: 'profile', number: 1, title: 'الحساب', icon: User },
  { id: 'program', number: 2, title: 'البرنامج', icon: GraduationCap },
  { id: 'services', number: 3, title: 'الخدمات', icon: Settings },
  { id: 'payment', number: 4, title: 'الدفع', icon: CreditCard },
  { id: 'registration', number: 5, title: 'التسجيل', icon: FileCheck },
  { id: 'acceptance', number: 6, title: 'القبول', icon: FileText },
  { id: 'visa', number: 7, title: 'التأشيرة', icon: Stamp },
  { id: 'tickets', number: 8, title: 'السفر', icon: Plane },
  { id: 'arrival', number: 9, title: 'الوصول', icon: MapPin },
];

// Map CRM substage to step number
const SUBSTAGE_TO_STEP: Record<string, number> = {
  'new': 1, 'collecting_info': 1, 'profile_incomplete': 1,
  'choosing_program': 2, 'docs_pending': 2, 'docs_review': 2,
  'docs_approved': 3, 'choosing_services': 3,
  'payment_pending': 4, 'partially_paid': 4, 'awaiting_payment': 4,
  'fully_paid': 5, 'registration_pending': 5, 'submitted': 5,
  'under_review': 6, 'offer_received': 6, 'offer_pending': 6,
  'offer_accepted': 7, 'visa_in_progress': 7, 'visa_pending': 7,
  'visa_approved': 8, 'booking_flights': 8, 'tickets_booked': 8,
  'arrived': 9, 'enrolled': 9, 'completed': 9,
};

function mapCrmSubstageToStep(substage?: string | null): number {
  if (!substage) return 1;
  return SUBSTAGE_TO_STEP[substage.toLowerCase()] || 1;
}

export function JourneyStepsFixed({ currentStep, crmSubstage }: JourneyStepsFixedProps) {
  const activeStep = crmSubstage ? mapCrmSubstageToStep(crmSubstage) : (currentStep || 1);
  
  const getStepStatus = (stepNumber: number): 'completed' | 'current' | 'pending' => {
    if (stepNumber < activeStep) return 'completed';
    if (stepNumber === activeStep) return 'current';
    return 'pending';
  };

  const completedSteps = Math.max(0, activeStep - 1);
  const progressPercent = (completedSteps / (steps.length - 1)) * 100;

  return (
    <TooltipProvider delayDuration={200}>
      {/* Progress bar at top of content */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 relative">
          {/* Vertical progress line on right side */}
          <div className="absolute left-1 top-1 bottom-1 w-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="w-full rounded-full transition-all duration-700 ease-out"
              style={{ 
                height: `${progressPercent}%`,
                background: 'linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.6))'
              }}
            />
          </div>

          <div className="flex items-center justify-between relative mr-4">
            {/* Background line */}
            <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-0.5 bg-muted rounded-full z-0" />
            
            {/* Progress line */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 right-4 h-0.5 rounded-full transition-all duration-700 z-0"
              style={{ 
                width: `calc(${progressPercent}% - 16px)`,
                background: 'linear-gradient(to left, hsl(var(--primary)), hsl(var(--primary) / 0.5))'
              }}
            />

            {steps.map((step) => {
              const status = getStepStatus(step.number);
              const Icon = step.icon;
              
              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 relative z-10 cursor-pointer group">
                      {/* Step circle */}
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300",
                          "border-2 text-xs font-bold",
                          status === 'completed' && [
                            "bg-primary border-primary text-primary-foreground",
                            "shadow-sm shadow-primary/30"
                          ],
                          status === 'current' && [
                            "bg-primary/15 border-primary text-primary",
                            "shadow-md shadow-primary/20 ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                          ],
                          status === 'pending' && [
                            "bg-muted border-muted-foreground/20 text-muted-foreground",
                            "group-hover:border-muted-foreground/40"
                          ]
                        )}
                      >
                        {status === 'completed' ? (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>

                      {/* Step title - hidden on very small screens */}
                      <span className={cn(
                        "text-[10px] font-medium text-center whitespace-nowrap hidden sm:block",
                        status === 'completed' && "text-primary",
                        status === 'current' && "text-foreground font-semibold",
                        status === 'pending' && "text-muted-foreground"
                      )}>
                        {step.title}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-center">
                    <p className="font-semibold text-sm">{step.title}</p>
                    {status === 'completed' && <p className="text-xs text-primary">✓ مكتمل</p>}
                    {status === 'current' && <p className="text-xs text-primary">● الخطوة الحالية</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
