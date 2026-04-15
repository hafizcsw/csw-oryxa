import { useState, ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
  description?: string;
  component: ReactNode;
}

interface MultiStepFormWrapperProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onSubmit: () => void;
  canProceed?: boolean;
  isSubmitting?: boolean;
}

export function MultiStepFormWrapper({
  steps,
  currentStep,
  onStepChange,
  onSubmit,
  canProceed = true,
  isSubmitting = false
}: MultiStepFormWrapperProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>خطوة {currentStep + 1} من {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex flex-col items-center flex-1">
            <button
              onClick={() => onStepChange(idx)}
              disabled={idx > currentStep}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                idx < currentStep && "bg-primary text-primary-foreground",
                idx === currentStep && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                idx > currentStep && "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {idx < currentStep ? <Check className="w-5 h-5" /> : idx + 1}
            </button>
            <div className="text-center mt-2">
              <p className={cn(
                "text-xs font-medium",
                idx === currentStep ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.title}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="bg-card rounded-lg border p-6 min-h-[400px]">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{steps[currentStep].title}</h3>
          {steps[currentStep].description && (
            <p className="text-sm text-muted-foreground mt-1">
              {steps[currentStep].description}
            </p>
          )}
        </div>
        <div className="mt-6">
          {steps[currentStep].component}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onStepChange(currentStep - 1)}
          disabled={currentStep === 0}
        >
          <ChevronRight className="w-4 h-4 ml-2" />
          السابق
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
          >
            {isSubmitting ? "جاري الحفظ..." : "حفظ وإنهاء"}
            <Check className="w-4 h-4 mr-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => onStepChange(currentStep + 1)}
            disabled={!canProceed}
          >
            التالي
            <ChevronLeft className="w-4 h-4 mr-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
