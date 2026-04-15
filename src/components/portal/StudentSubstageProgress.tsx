import { FileText, Eye, CheckCircle, DollarSign, Send, Mail, PartyPopper } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type StudentSubstage =
  | 'collecting_docs' | 'docs_review' | 'docs_approved'
  | 'payment_pending' | 'partially_paid' | 'fully_paid'
  | 'ready_to_submit' | 'submitted' | 'offer_received' | 'offer_accepted';

interface SubstageInfo {
  id: StudentSubstage;
  label: string;
  icon: React.ReactNode;
  order: number;
}

const SUBSTAGES: SubstageInfo[] = [
  { id: 'collecting_docs', label: 'جمع المستندات', icon: <FileText className="w-4 h-4" />, order: 1 },
  { id: 'docs_review', label: 'مراجعة المستندات', icon: <Eye className="w-4 h-4" />, order: 2 },
  { id: 'docs_approved', label: 'اعتماد المستندات', icon: <CheckCircle className="w-4 h-4" />, order: 3 },
  { id: 'payment_pending', label: 'دفعة مطلوبة', icon: <DollarSign className="w-4 h-4" />, order: 4 },
  { id: 'partially_paid', label: 'دفعة جزئية', icon: <DollarSign className="w-4 h-4" />, order: 5 },
  { id: 'fully_paid', label: 'مدفوع بالكامل', icon: <CheckCircle className="w-4 h-4" />, order: 6 },
  { id: 'ready_to_submit', label: 'جاهز للتقديم', icon: <Send className="w-4 h-4" />, order: 7 },
  { id: 'submitted', label: 'تم التقديم', icon: <Mail className="w-4 h-4" />, order: 8 },
  { id: 'offer_received', label: 'وصول العرض', icon: <Mail className="w-4 h-4" />, order: 9 },
  { id: 'offer_accepted', label: 'قبول العرض', icon: <PartyPopper className="w-4 h-4" />, order: 10 },
];

interface Props {
  currentSubstage?: StudentSubstage | null;
  progress?: number | null;
  compact?: boolean;
}

export function StudentSubstageProgress({ currentSubstage, progress, compact }: Props) {
  const currentStage = SUBSTAGES.find(s => s.id === currentSubstage);
  const currentOrder = currentStage?.order || 1;
  const progressValue = progress ?? 0;

  // Get stage color based on progress
  const getStageColor = (order: number) => {
    if (order < currentOrder) return 'from-green-500 to-green-600';
    if (order === currentOrder) return 'from-purple-500 to-purple-600';
    return 'from-gray-300 to-gray-400';
  };

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border-2 border-purple-100 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-100/50 to-blue-100/50 animate-pulse" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getStageColor(currentOrder)} text-white flex items-center justify-center shadow-lg`}>
                {currentStage?.icon}
              </div>
              <span className="font-semibold text-gray-800">{currentStage?.label}</span>
            </div>
            <div className="text-sm text-gray-600">
              المرحلة {currentOrder} من 10
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">التقدم الكلي</span>
              <span className="font-bold text-purple-600">{progressValue}%</span>
            </div>
            <div className="relative">
              <Progress value={progressValue} className="h-2" />
              <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {SUBSTAGES.map((stage) => {
        const isCompleted = stage.order < currentOrder;
        const isCurrent = stage.id === currentSubstage;
        const isPending = stage.order > currentOrder;

        return (
          <div
            key={stage.id}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              isCurrent
                ? "bg-purple-50 border-purple-300"
                : isCompleted
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isCurrent
                  ? "bg-purple-600 text-white"
                  : isCompleted
                  ? "bg-green-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {stage.icon}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{stage.label}</div>
              <div className="text-sm text-gray-500">المرحلة {stage.order}</div>
            </div>
            {isCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
            {isCurrent && (
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
