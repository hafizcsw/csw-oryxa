import { TrendingUp, Target, Zap, Bell, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface SummaryCardsProps {
  progress: number;
  currentStage: string | null;
  pendingTasks: number;
  notifications: number;
  userName?: string;
}

const STAGE_LABELS: Record<string, string> = {
  'new': 'استفسار جديد',
  'inquiry': 'استفسار',
  'docs_collection': 'جمع المستندات',
  'docs_review': 'مراجعة الملف',
  'submitted': 'تم التقديم',
  'accepted': 'تم القبول',
  'enrolled': 'مسجل',
};

function getProgressMessage(progress: number): { message: string; emoji: string } {
  if (progress < 40) {
    return {
      message: "لنبدأ بالأساسيات: أكمل بياناتك الشخصية واختر 2–3 برامج مفضلة.",
      emoji: "🚀"
    };
  } else if (progress < 80) {
    return {
      message: "أنت على الطريق الصحيح! الآن نحتاج الوثائق الأساسية قبل الانتقال لمرحلة القبول.",
      emoji: "📄"
    };
  } else {
    return {
      message: "ملفك شبه جاهز! تابع فقط أي ملاحظات من فريقنا أو مدفوعات معلّقة.",
      emoji: "🎉"
    };
  }
}

export function DashboardSummaryCards({ progress, currentStage, pendingTasks, notifications, userName }: SummaryCardsProps) {
  const stageLabel = currentStage ? (STAGE_LABELS[currentStage] || currentStage) : 'غير محدد';
  const progressInfo = getProgressMessage(progress);
  
  const cards = [
    {
      title: 'نسبة الإنجاز',
      value: `${progress}%`,
      subtitle: 'كلما اقتربت من 100٪، زادت سرعة إنهاء إجراءاتك',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'المرحلة الحالية',
      value: stageLabel,
      subtitle: 'يمكن أن تتغير تلقائياً بعد مراجعة فريقنا',
      icon: Target,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'المهام المعلقة',
      value: pendingTasks.toString(),
      subtitle: pendingTasks > 0 ? 'وثائق تحتاج للرفع' : 'لا توجد مهام معلقة',
      icon: Zap,
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'الإشعارات',
      value: notifications.toString(),
      subtitle: notifications > 0 ? 'تحديثات جديدة' : 'لا توجد تحديثات',
      icon: Bell,
      color: 'from-purple-500 to-pink-600',
      bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Welcome Message with Progress Tip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl p-5 border border-primary/20"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-lg mb-1">
              {userName ? `مرحباً، يا ${userName} 👋` : 'مرحباً بك 👋'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ملفك مكتمل بنسبة <span className="font-bold text-primary">{progress}%</span>.{' '}
              {progressInfo.emoji} {progressInfo.message}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 hover:shadow-lg transition-all duration-300"
          >
            {/* Gradient accent */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color}`} />
            
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-foreground truncate">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.subtitle}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.bgColor} shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>

            {/* Progress bar for first card */}
            {index === 0 && (
              <div className="mt-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className={`h-full bg-gradient-to-r ${card.color}`}
                  />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
