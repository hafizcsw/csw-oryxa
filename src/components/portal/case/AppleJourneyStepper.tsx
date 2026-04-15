import { Check, User, GraduationCap, Settings, CreditCard, FileCheck, FileText, Stamp, Plane, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface AppleJourneyStepperProps {
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

export function AppleJourneyStepper({ currentStep, crmSubstage }: AppleJourneyStepperProps) {
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
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 shadow-xl"
      >
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        
        <div className="relative p-6">
          {/* Header with Progress */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">رحلتك الدراسية</h3>
              <p className="text-2xl font-bold text-foreground">
                الخطوة {activeStep} من {steps.length}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {Math.round(progressPercent)}%
              </span>
              <p className="text-xs text-muted-foreground">مكتمل</p>
            </div>
          </div>

          {/* Steps Container */}
          <div className="relative">
            {/* Background Track */}
            <div className="absolute top-6 left-6 right-6 h-1 bg-muted rounded-full overflow-hidden">
              {/* Animated Progress Bar */}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-emerald-500"
              />
            </div>

            {/* Steps */}
            <div className="flex items-start justify-between relative">
              {steps.map((step, index) => {
                const status = getStepStatus(step.number);
                const Icon = step.icon;
                
                return (
                  <Tooltip key={step.id}>
                    <TooltipTrigger asChild>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 * index }}
                        className="flex flex-col items-center gap-2 cursor-pointer group"
                      >
                        {/* Step Circle */}
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className={cn(
                            "relative h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300",
                            "border-2 shadow-lg",
                            status === 'completed' && [
                              "bg-gradient-to-br from-primary to-emerald-500 border-transparent",
                              "shadow-primary/40"
                            ],
                            status === 'current' && [
                              "bg-background border-primary",
                              "shadow-primary/30 ring-4 ring-primary/20"
                            ],
                            status === 'pending' && [
                              "bg-muted border-muted-foreground/20",
                              "group-hover:border-muted-foreground/40"
                            ]
                          )}
                        >
                          {/* Current Step Pulse */}
                          {status === 'current' && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
                          )}
                          
                          {status === 'completed' ? (
                            <Check className="h-5 w-5 text-primary-foreground" strokeWidth={3} />
                          ) : (
                            <Icon className={cn(
                              "h-5 w-5 transition-colors",
                              status === 'current' ? "text-primary" : "text-muted-foreground"
                            )} />
                          )}
                        </motion.div>

                        {/* Step Label */}
                        <span className={cn(
                          "text-[10px] md:text-xs font-medium text-center whitespace-nowrap transition-colors",
                          status === 'completed' && "text-primary",
                          status === 'current' && "text-foreground font-semibold",
                          status === 'pending' && "text-muted-foreground"
                        )}>
                          {step.title}
                        </span>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-center bg-popover/95 backdrop-blur-sm">
                      <p className="font-semibold">{step.title}</p>
                      {status === 'completed' && <p className="text-xs text-emerald-500">✓ مكتمل</p>}
                      {status === 'current' && <p className="text-xs text-primary">● الخطوة الحالية</p>}
                      {status === 'pending' && <p className="text-xs text-muted-foreground">○ قادم</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
