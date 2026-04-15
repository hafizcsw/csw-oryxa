import { Check, User, GraduationCap, Settings, CreditCard, FileCheck, FileText, Stamp, Plane, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";

interface JourneyStepsProps {
  currentStep?: number; // 1-9
  crmSubstage?: string | null;
}

interface Step {
  id: string;
  number: number;
  titleKey: string;
  icon: React.ElementType;
  descriptionKey: string;
}

const stepsConfig: Step[] = [
  { id: 'profile', number: 1, titleKey: 'portal.journeySteps.fillAccount', icon: User, descriptionKey: 'portal.journeySteps.fillAccountDesc' },
  { id: 'program', number: 2, titleKey: 'portal.journeySteps.chooseProgram', icon: GraduationCap, descriptionKey: 'portal.journeySteps.chooseProgramDesc' },
  { id: 'services', number: 3, titleKey: 'portal.journeySteps.chooseServices', icon: Settings, descriptionKey: 'portal.journeySteps.chooseServicesDesc' },
  { id: 'payment', number: 4, titleKey: 'portal.journeySteps.payment', icon: CreditCard, descriptionKey: 'portal.journeySteps.paymentDesc' },
  { id: 'registration', number: 5, titleKey: 'portal.journeySteps.registration', icon: FileCheck, descriptionKey: 'portal.journeySteps.registrationDesc' },
  { id: 'acceptance', number: 6, titleKey: 'portal.journeySteps.acceptanceLetter', icon: FileText, descriptionKey: 'portal.journeySteps.acceptanceLetterDesc' },
  { id: 'visa', number: 7, titleKey: 'portal.journeySteps.travelVisa', icon: Stamp, descriptionKey: 'portal.journeySteps.travelVisaDesc' },
  { id: 'tickets', number: 8, titleKey: 'portal.journeySteps.flightTickets', icon: Plane, descriptionKey: 'portal.journeySteps.flightTicketsDesc' },
  { id: 'arrival', number: 9, titleKey: 'portal.journeySteps.arrival', icon: MapPin, descriptionKey: 'portal.journeySteps.arrivalDesc' },
];

// Map CRM substage to step number
const SUBSTAGE_TO_STEP: Record<string, number> = {
  // Stage 1: ملء الحساب
  'new': 1,
  'collecting_info': 1,
  'profile_incomplete': 1,
  
  // Stage 2: اختيار البرنامج
  'choosing_program': 2,
  'docs_pending': 2,
  'docs_review': 2,
  
  // Stage 3: اختيار الخدمات
  'docs_approved': 3,
  'choosing_services': 3,
  
  // Stage 4: الدفع
  'payment_pending': 4,
  'partially_paid': 4,
  'awaiting_payment': 4,
  
  // Stage 5: التسجيل
  'fully_paid': 5,
  'registration_pending': 5,
  'submitted': 5,
  
  // Stage 6: خطاب القبول
  'under_review': 6,
  'offer_received': 6,
  'offer_pending': 6,
  
  // Stage 7: تأشيرة السفر
  'offer_accepted': 7,
  'visa_in_progress': 7,
  'visa_pending': 7,
  
  // Stage 8: تذاكر الطيران
  'visa_approved': 8,
  'booking_flights': 8,
  'tickets_booked': 8,
  
  // Stage 9: وصول
  'arrived': 9,
  'enrolled': 9,
  'completed': 9,
};

export function mapCrmSubstageToStep(substage?: string | null): number {
  if (!substage) return 1;
  return SUBSTAGE_TO_STEP[substage.toLowerCase()] || 1;
}

export function JourneySteps({ currentStep, crmSubstage }: JourneyStepsProps) {
  const { t } = useLanguage();
  // Use CRM substage if available, otherwise use provided currentStep
  const activeStep = crmSubstage ? mapCrmSubstageToStep(crmSubstage) : (currentStep || 1);
  
  const getStepStatus = (stepNumber: number): 'completed' | 'current' | 'pending' => {
    if (stepNumber < activeStep) return 'completed';
    if (stepNumber === activeStep) return 'current';
    return 'pending';
  };

  // Progress width based on completed steps
  const completedSteps = Math.max(0, activeStep - 1);
  const progressPercent = (completedSteps / (stepsConfig.length - 1)) * 100;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mt-6 overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex items-start gap-0 relative min-w-[800px] flex-row-reverse px-4">
          {/* Background line */}
          <div className="absolute top-5 left-8 right-8 h-1 bg-muted/50 rounded-full z-0" />
          
          {/* Progress line with gradient - starts from RIGHT for RTL */}
          <div 
            className="absolute top-5 right-8 h-1 rounded-full transition-all duration-700 ease-out z-0"
            style={{ 
              width: `calc(${progressPercent}% - 32px)`,
              background: 'linear-gradient(to left, hsl(var(--primary)), hsl(var(--primary) / 0.6))'
            }}
          />

          {stepsConfig.map((step) => {
            const status = getStepStatus(step.number);
            const Icon = step.icon;
            
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <div className="flex-1 flex flex-col items-center gap-2.5 relative cursor-pointer group">
                    {/* Step circle */}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 z-10",
                        "border-2 font-bold text-sm relative",
                        // Completed state
                        status === 'completed' && [
                          "bg-primary border-primary text-primary-foreground",
                          "shadow-md shadow-primary/30"
                        ],
                        // Current state with pulse animation
                        status === 'current' && [
                          "bg-primary/10 border-primary text-primary",
                          "shadow-lg shadow-primary/20",
                          "before:absolute before:inset-0 before:rounded-full before:border-2 before:border-primary/50",
                          "before:animate-ping before:opacity-75"
                        ],
                        // Pending state
                        status === 'pending' && [
                          "bg-muted border-muted-foreground/20 text-muted-foreground",
                          "group-hover:border-muted-foreground/40 group-hover:bg-muted/80"
                        ]
                      )}
                    >
                      {status === 'completed' ? (
                        <Check className="h-5 w-5" strokeWidth={3} />
                      ) : (
                        <Icon className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          status === 'current' && "scale-110",
                          "group-hover:scale-110"
                        )} />
                      )}
                    </div>

                    {/* Step number badge for current */}
                    {status === 'current' && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center z-20">
                        {step.number}
                      </div>
                    )}

                    {/* Step title */}
                    <p className={cn(
                      "text-xs font-medium text-center whitespace-nowrap transition-colors duration-200",
                      status === 'completed' && "text-primary font-semibold",
                      status === 'current' && "text-foreground font-semibold",
                      status === 'pending' && "text-muted-foreground group-hover:text-foreground/70"
                    )}>
                      {t(step.titleKey)}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-center">
                  <p className="font-semibold">{t(step.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(step.descriptionKey)}</p>
                  {status === 'completed' && (
                    <p className="text-xs text-primary mt-1">✓ {t('portal.journeySteps.completed')}</p>
                  )}
                  {status === 'current' && (
                    <p className="text-xs text-primary mt-1">● {t('portal.journeySteps.currentStep')}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
