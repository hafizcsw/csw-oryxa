import { CheckCircle2, Circle, MessageCircle, FileText, Search, Send, GraduationCap, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface Step {
  id: string;
  title: string;
  completed: boolean;
}

interface PortalSidebarProps {
  steps: Step[];
  progress: number;
  currentStage?: string | null;
  pendingTasks?: { id: string; title: string; urgent?: boolean }[];
}

export function PortalSidebar({ steps, progress, currentStage, pendingTasks = [] }: PortalSidebarProps) {
  const { t } = useLanguage();
  
  const CRM_STAGES = [
    { id: 'new', label: t('portal.crmStages.new'), icon: MessageCircle },
    { id: 'docs_collection', label: t('portal.crmStages.docsCollection'), icon: FileText },
    { id: 'docs_review', label: t('portal.crmStages.docsReview'), icon: Search },
    { id: 'submitted', label: t('portal.crmStages.submitted'), icon: Send },
    { id: 'accepted', label: t('portal.crmStages.accepted'), icon: GraduationCap },
  ];
  
  const currentStageIndex = CRM_STAGES.findIndex(s => s.id === currentStage);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
      {/* Progress Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground">{t('portal.sidebarProgress.title')}</h3>
          <span className="text-2xl font-bold text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* CRM Stage Timeline */}
      {currentStage && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-muted-foreground mb-4">{t('portal.sidebarProgress.applicationStage')}</h4>
          <div className="space-y-3">
            {CRM_STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const StageIcon = stage.icon;

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30'
                      : isCompleted
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/20'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StageIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isCurrent
                      ? 'text-primary'
                      : isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
                  }`}>
                    {stage.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            {t('portal.sidebarProgress.pendingTasks')}
          </h4>
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-xl text-sm ${
                  task.urgent
                    ? 'bg-red-500/10 dark:bg-red-500/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    : 'bg-amber-500/10 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                }`}
              >
                {task.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist Steps */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">{t('portal.sidebarProgress.checklist')}</h4>
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                step.completed
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/20'
                  : 'bg-muted/50'
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={`text-sm font-medium ${
                step.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
