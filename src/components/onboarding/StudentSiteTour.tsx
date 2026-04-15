import { useEffect, useState, useCallback, useRef } from 'react';
import { useStudentTour } from '@/contexts/StudentTourContext';
import { Button } from '@/components/ui/button';
import { Sparkles, User, MessageCircle, GraduationCap, X } from 'lucide-react';

const STEPS_CONFIG = {
  welcome: {
    title: 'مرحباً بك في حسابك الشخصي 👋',
    body: 'تم تفعيل حسابك في CSW وربطه برقم الواتساب الخاص بك. سنأخذك في جولة سريعة.',
    icon: Sparkles,
    targetId: null,
  },
  account_button: {
    title: 'زر "حسابي الشخصي"',
    body: 'من هنا تفتح لوحة الطالب: بياناتك، المستندات، وحالة الطلب.',
    icon: User,
    targetId: 'tour-account-button',
  },
  chat_box: {
    title: 'محادثتك مع ملاك',
    body: 'تحدث مع ملاك في أي وقت للحصول على توصيات مخصصة.',
    icon: MessageCircle,
    targetId: 'tour-chat-box',
  },
  programs: {
    title: 'البرامج المقترحة',
    body: 'برامج تناسبك بناءً على محادثتك. احفظ ما يعجبك بالضغط على ❤️',
    icon: GraduationCap,
    targetId: 'tour-programs',
  },
};

type StepId = 'welcome' | 'account_button' | 'chat_box' | 'programs';
const STEP_ORDER: StepId[] = ['welcome', 'account_button', 'chat_box', 'programs'];

type TooltipPosition = {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom';
};

export function StudentSiteTour() {
  const { isActive, currentStep, next, back, skip } = useStudentTour();
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const retryCountRef = useRef(0);

  // Check if target element exists, with retries
  const findTargetElement = useCallback((targetId: string | null): HTMLElement | null => {
    if (!targetId) return null;
    return document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
  }, []);

  // Skip to next step if current target doesn't exist
  const skipToValidStep = useCallback(() => {
    if (!isActive || currentStep === 'done') return;
    
    const config = STEPS_CONFIG[currentStep as StepId];
    if (!config) return;
    
    // Welcome step always valid
    if (!config.targetId) {
      setIsReady(true);
      return;
    }
    
    // Try to find the element
    const el = findTargetElement(config.targetId);
    if (el) {
      setIsReady(true);
      return;
    }
    
    // Retry a few times before skipping
    if (retryCountRef.current < 3) {
      retryCountRef.current++;
      console.log(`[StudentSiteTour] Element ${config.targetId} not found, retry ${retryCountRef.current}/3...`);
      setTimeout(() => skipToValidStep(), 500);
      return;
    }
    
    // Skip this step if element not found after retries
    console.log(`[StudentSiteTour] Skipping step ${currentStep} - element not found`);
    retryCountRef.current = 0;
    next();
  }, [isActive, currentStep, findTargetElement, next]);

  // Check if step is valid when step changes
  useEffect(() => {
    if (!isActive || currentStep === 'done') return;
    setIsReady(false);
    retryCountRef.current = 0;
    
    // Small delay to let DOM update
    setTimeout(() => skipToValidStep(), 200);
  }, [currentStep, isActive, skipToValidStep]);

  const calculatePosition = useCallback(() => {
    if (!isActive || currentStep === 'done' || !isReady) return;

    const config = STEPS_CONFIG[currentStep as StepId];
    
    // Welcome step - centered modal
    if (!config?.targetId) {
      setTooltipPosition(null);
      setTargetElement(null);
      return;
    }

    const el = findTargetElement(config.targetId);
    if (!el) {
      setTooltipPosition(null);
      setTargetElement(null);
      return;
    }

    setTargetElement(el);
    
    // ✅ عناصر الـ Header ثابتة - لا تستخدم scrollIntoView
    const isHeaderElement = config.targetId === 'tour-account-button';
    
    if (!isHeaderElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Wait for scroll/render to complete
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      
      // ✅ حالة زر الحساب في الـ Header - موضع ثابت تحته مباشرة
      if (isHeaderElement) {
        setTooltipPosition({
          top: rect.bottom + 12,
          left: Math.min(rect.left + rect.width / 2, window.innerWidth - 160),
          arrowPosition: 'top',
        });
        return;
      }
      
      // باقي العناصر
      const tooltipHeight = 180;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow > tooltipHeight + 20) {
        setTooltipPosition({
          top: rect.bottom + 12,
          left: rect.left + rect.width / 2,
          arrowPosition: 'top',
        });
      } else {
        setTooltipPosition({
          top: rect.top - tooltipHeight - 12,
          left: rect.left + rect.width / 2,
          arrowPosition: 'bottom',
        });
      }
    }, isHeaderElement ? 100 : 300);
  }, [isActive, currentStep, isReady, findTargetElement]);

  useEffect(() => {
    if (isReady) {
      calculatePosition();
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition);
    }
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [calculatePosition, isReady]);

  // Add/remove highlight class on target element
  useEffect(() => {
    if (targetElement) {
      targetElement.classList.add('tour-highlight');
    }
    return () => {
      if (targetElement) {
        targetElement.classList.remove('tour-highlight');
      }
    };
  }, [targetElement]);

  if (!isActive || currentStep === 'done' || !isReady) return null;

  const config = STEPS_CONFIG[currentStep as StepId];
  if (!config) return null;
  
  const Icon = config.icon;
  const stepNumber = STEP_ORDER.indexOf(currentStep as StepId);

  // Welcome step - small centered modal
  if (!config.targetId) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 animate-fade-in">
        <div className="fixed inset-0 bg-black/40" onClick={skip} />
        <div className="relative max-w-xs w-full bg-card rounded-xl shadow-xl border border-border p-4 animate-scale-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-foreground flex-1">{config.title}</h3>
            <button onClick={skip} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{config.body}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{stepNumber + 1}/4</span>
            <Button 
              size="sm" 
              onClick={next}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              ابدأ الجولة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Steps with target - positioned tooltip
  if (!tooltipPosition) return null;

  return (
    <>
      {/* Backdrop - clicking skips tour */}
      <div 
        className="fixed inset-0 z-[9997] cursor-pointer" 
        onClick={skip}
        style={{ background: 'transparent' }}
      />
      
      {/* Tooltip */}
      <div 
        className="fixed z-[9999] w-72 bg-card rounded-xl shadow-xl border border-border animate-fade-in"
        style={{ 
          top: tooltipPosition.top,
          left: Math.min(Math.max(tooltipPosition.left, 150), window.innerWidth - 150),
          transform: 'translateX(-50%)',
        }}
      >
        {/* Arrow */}
        <div 
          className={`absolute w-3 h-3 bg-card border-border rotate-45 ${
            tooltipPosition.arrowPosition === 'top' 
              ? '-top-1.5 border-t border-l' 
              : '-bottom-1.5 border-b border-r'
          }`}
          style={{ left: '50%', transform: 'translateX(-50%) rotate(45deg)' }}
        />
        
        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-sm text-foreground flex-1">{config.title}</h3>
            <button onClick={skip} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{config.body}</p>
          
          {/* Progress & Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === stepNumber ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            
            <div className="flex gap-1">
              {currentStep !== 'welcome' && (
                <Button variant="ghost" size="sm" onClick={back} className="h-7 px-2 text-xs">
                  رجوع
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={next}
                className="h-7 px-3 text-xs bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {currentStep === 'programs' ? 'إنهاء' : 'التالي'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
