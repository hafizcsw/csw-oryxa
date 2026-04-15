import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type StepId = 'welcome' | 'account_button' | 'chat_box' | 'programs' | 'done';

interface StudentTourContextValue {
  isActive: boolean;
  currentStep: StepId;
  startTour: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const StudentTourContext = createContext<StudentTourContextValue | undefined>(undefined);

const TOUR_KEY = 'malak_tour_completed';

export function StudentTourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>('welcome');

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (done === 'true') setIsActive(false);
  }, []);

  const startTour = () => {
    // لا نبدأ الجولة إلا إذا لم تُنجز من قبل
    if (localStorage.getItem(TOUR_KEY) === 'true') return;
    setCurrentStep('welcome');
    setIsActive(true);
  };

  const next = () => {
    setCurrentStep((prev) => {
      if (prev === 'welcome') return 'account_button';
      if (prev === 'account_button') return 'chat_box';
      if (prev === 'chat_box') return 'programs';
      if (prev === 'programs') {
        localStorage.setItem(TOUR_KEY, 'true');
        setIsActive(false);
        return 'done';
      }
      return prev;
    });
  };

  const back = () => {
    setCurrentStep((prev) => {
      if (prev === 'programs') return 'chat_box';
      if (prev === 'chat_box') return 'account_button';
      if (prev === 'account_button') return 'welcome';
      return prev;
    });
  };

  const skip = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setIsActive(false);
    setCurrentStep('done');
  };

  return (
    <StudentTourContext.Provider value={{ isActive, currentStep, startTour, next, back, skip }}>
      {children}
    </StudentTourContext.Provider>
  );
}

export const useStudentTour = () => {
  const ctx = useContext(StudentTourContext);
  if (!ctx) throw new Error('useStudentTour must be used within StudentTourProvider');
  return ctx;
};
