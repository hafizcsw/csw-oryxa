import { useState, useEffect } from "react";
import { IconBox } from "@/components/ui/icon-box";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  GraduationCap,
  FileSignature,
  Languages,
  FolderOpen,
  Loader2,
  RefreshCw,
  User,
  Heart,
  Briefcase,
  CreditCard,
  ClipboardCheck,
  Plane,
  Ticket,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types
interface ReadyFile {
  id: string;
  file_kind: string;
  file_name: string;
  status: 'pending' | 'in_progress' | 'ready' | 'signed';
  created_at: string;
  storage_bucket?: string;
  storage_path?: string;
}

interface ApplicationStatusTabProps {
  onTabChange?: (tab: string) => void;
  progress?: number;
  currentStep?: number;
  crmSubstage?: string | null;
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'في الانتظار', color: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'قيد التجهيز', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: RefreshCw },
  ready: { label: 'جاهز', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  signed: { label: 'موقع', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
};

// File categories
const FILE_CATEGORIES = {
  acceptance_letter: { title: 'خطاب القبول', icon: GraduationCap, priority: 1 },
  contract: { title: 'العقود', icon: FileSignature, priority: 2 },
  translated_doc: { title: 'المستندات المترجمة', icon: Languages, priority: 3 },
  other: { title: 'ملفات أخرى', icon: FolderOpen, priority: 4 },
};

// Journey steps definition
const JOURNEY_STEPS = [
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

// Helper to get category from file_kind
function getCategory(fileKind: string): keyof typeof FILE_CATEGORIES {
  if (fileKind.includes('acceptance') || fileKind.includes('قبول')) return 'acceptance_letter';
  if (fileKind.includes('contract') || fileKind.includes('عقد')) return 'contract';
  if (fileKind.includes('translated') || fileKind.includes('ترجمة') || fileKind.includes('مترجم')) return 'translated_doc';
  return 'other';
}

// Journey Progress Component
function JourneyProgress({ progress, currentStep }: { progress: number; currentStep: number }) {
  const safeStep = Math.min(Math.max(currentStep, 1), 9);
  const currentStepData = JOURNEY_STEPS[safeStep - 1];
  
  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${currentStepData.color}20` }}
          >
            <currentStepData.icon className="w-5 h-5" style={{ color: currentStepData.color }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">رحلتك الدراسية</h2>
            <p className="text-sm text-muted-foreground">
              الخطوة {safeStep} من 9: {currentStepData.title}
            </p>
          </div>
        </div>
        <div 
          className="text-2xl font-bold"
          style={{ color: currentStepData.color }}
        >
          {progress}%
        </div>
      </div>

      {/* Steps Progress */}
      <div className="relative">
        {/* Background Line */}
        <div className="absolute top-5 right-5 left-5 h-1 bg-muted rounded-full" />
        
        {/* Progress Line */}
        <div 
          className="absolute top-5 right-5 h-1 rounded-full transition-all duration-700 ease-out"
          style={{ 
            width: `calc(${((safeStep - 1) / 8) * 100}% - 10px)`,
            background: `linear-gradient(to left, ${currentStepData.color}, ${JOURNEY_STEPS[0].color})`
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {JOURNEY_STEPS.map((step) => {
            const isCompleted = step.number < safeStep;
            const isCurrent = step.number === safeStep;
            const isPending = step.number > safeStep;
            const Icon = step.icon;
            
            return (
              <div key={step.number} className="flex flex-col items-center">
                {/* Circle */}
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isCompleted && "border-transparent",
                    isCurrent && "border-transparent ring-4 ring-offset-2 ring-offset-background ring-primary/30",
                    isPending && "bg-muted border-muted-foreground/20"
                  )}
                  style={{
                    backgroundColor: isCompleted || isCurrent ? step.color : undefined,
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Icon 
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isCurrent && "text-white",
                        isPending && "text-muted-foreground/50"
                      )}
                    />
                  )}
                </div>
                
                {/* Label */}
                <span 
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors text-center",
                    isCompleted && "text-foreground",
                    isCurrent && "text-foreground font-bold",
                    isPending && "text-muted-foreground/60"
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-8">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ 
              width: `${progress}%`,
              background: `linear-gradient(to left, ${currentStepData.color}, ${JOURNEY_STEPS[0].color})`
            }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          ✨ أنت الآن في مرحلة: <span className="font-medium text-foreground">{currentStepData.title}</span>
        </p>
      </div>
    </div>
  );
}

// File Section Component
function FileSection({ 
  category, 
  files, 
  onDownload,
  downloadingId 
}: { 
  category: keyof typeof FILE_CATEGORIES;
  files: ReadyFile[];
  onDownload: (file: ReadyFile) => void;
  downloadingId: string | null;
}) {
  const config = FILE_CATEGORIES[category];
  const Icon = config.icon;
  const readyCount = files.filter(f => f.status === 'ready' || f.status === 'signed').length;
  
  if (files.length === 0) return null;
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Category Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <IconBox icon={Icon} size="md" variant="primary" />
          <span className="font-semibold text-foreground">{config.title}</span>
        </div>
        {readyCount > 0 && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {readyCount} جاهز
          </Badge>
        )}
      </div>
      
      {/* Files List */}
      <div className="divide-y divide-border">
        {files.map((file) => {
          const statusConfig = STATUS_CONFIG[file.status];
          const StatusIcon = statusConfig.icon;
          const canDownload = file.status === 'ready' || file.status === 'signed';
          const isDownloading = downloadingId === file.id;
          
          return (
            <div 
              key={file.id}
              className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground">{file.file_name}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className={cn("gap-1", statusConfig.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </Badge>
                
                {canDownload && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => onDownload(file)}
                    disabled={isDownloading}
                    className="h-8 w-8 p-0"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد ملفات جاهزة بعد</h3>
      <p className="text-sm text-muted-foreground">
        فريق العمل يجهز مستنداتك، سنبلغك عند الجاهزية
      </p>
    </div>
  );
}

// Main Component
export function ApplicationStatusTab({ 
  onTabChange, 
  progress = 33, 
  currentStep = 3,
  crmSubstage 
}: ApplicationStatusTabProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<ReadyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch ready files from CRM
  const fetchReadyFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'get_ready_files' }
      });

      if (fnError) throw fnError;
      
      if (data?.ok && data?.files) {
        setFiles(data.files);
      } else if (data?.error === 'FEATURE_NOT_AVAILABLE') {
        setFiles([]);
      } else {
        setFiles([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch ready files:', e);
      setError('فشل في تحميل الملفات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyFiles();
  }, []);

  // Handle file download
  const handleDownload = async (file: ReadyFile) => {
    if (!file.storage_path) {
      toast({ title: 'خطأ', description: 'مسار الملف غير متوفر', variant: 'destructive' });
      return;
    }

    setDownloadingId(file.id);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('student-portal-api', {
        body: { 
          action: 'sign_ready_file',
          file_id: file.id
        }
      });

      if (fnError) throw fnError;
      
      if (data?.signed_url) {
        window.open(data.signed_url, '_blank');
        toast({ title: 'تم', description: 'جاري تحميل الملف' });
      } else {
        throw new Error('فشل في الحصول على رابط التحميل');
      }
    } catch (e: any) {
      console.error('Download failed:', e);
      toast({ title: 'خطأ', description: 'فشل في تحميل الملف', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  // Group files by category
  const groupedFiles = files.reduce((acc, file) => {
    const category = getCategory(file.file_kind);
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as Record<keyof typeof FILE_CATEGORIES, ReadyFile[]>);

  // Sort categories by priority
  const sortedCategories = Object.entries(FILE_CATEGORIES)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([key]) => key as keyof typeof FILE_CATEGORIES);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Journey skeleton */}
        <div className="bg-card rounded-xl border border-border p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-40 mb-4" />
          <div className="flex justify-between">
            {[1,2,3,4,5,6,7,8,9].map(i => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="w-12 h-3 bg-muted rounded" />
              </div>
            ))}
          </div>
          <div className="h-3 bg-muted rounded-full mt-8" />
        </div>
        
        {/* Files skeleton */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="h-5 bg-muted rounded w-32" />
            </div>
            <div className="space-y-3">
              <div className="h-12 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <JourneyProgress progress={progress} currentStep={currentStep} />
        <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-2">{error}</h3>
          <Button variant="outline" onClick={fetchReadyFiles} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const hasFiles = files.length > 0;
  const readyCount = files.filter(f => f.status === 'ready' || f.status === 'signed').length;

  return (
    <div className="space-y-6">
      {/* Journey Progress at Top */}
      <JourneyProgress progress={progress} currentStep={currentStep} />

      {/* Files Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">الملفات والمستندات الجاهزة</h2>
          <p className="text-muted-foreground text-sm mt-1">
            الملفات التي تم تجهيزها من فريق العمل
          </p>
        </div>
        
        {hasFiles && (
          <Button variant="outline" size="sm" onClick={fetchReadyFiles} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            تحديث
          </Button>
        )}
      </div>

      {/* Summary Badge */}
      {hasFiles && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <span className="text-sm text-foreground">
            <strong>{readyCount}</strong> ملفات جاهزة للتحميل من أصل <strong>{files.length}</strong>
          </span>
        </div>
      )}

      {/* File Sections */}
      {hasFiles ? (
        <div className="space-y-4">
          {sortedCategories.map((categoryKey) => {
            const categoryFiles = groupedFiles[categoryKey] || [];
            
            return (
              <FileSection
                key={categoryKey}
                category={categoryKey}
                files={categoryFiles}
                onDownload={handleDownload}
                downloadingId={downloadingId}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Help Note */}
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">
          إذا كان لديك استفسار عن ملفاتك، تواصل معنا عبر الدردشة أو واتساب
        </p>
      </div>
    </div>
  );
}
