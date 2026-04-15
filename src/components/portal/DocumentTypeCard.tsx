import { FileText, CheckCircle, Clock, AlertCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface DocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
  status: 'uploaded' | 'pending' | 'reviewing' | 'rejected';
  fileName?: string;
}

interface DocumentTypeCardProps {
  document: DocumentType;
  onUpload: (docType: string) => void;
  onView?: (docType: string) => void;
}

const STATUS_CONFIG = {
  uploaded: {
    icon: CheckCircle,
    label: 'تم الرفع',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  pending: {
    icon: AlertCircle,
    label: 'مطلوب',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  reviewing: {
    icon: Clock,
    label: 'قيد المراجعة',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  rejected: {
    icon: X,
    label: 'مرفوض',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 dark:bg-red-500/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

export function DocumentTypeCard({ document, onUpload, onView }: DocumentTypeCardProps) {
  const config = STATUS_CONFIG[document.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative bg-card rounded-2xl border-2 ${config.borderColor} p-5 hover:shadow-md transition-all duration-300`}
    >
      {/* Status badge */}
      <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      </div>

      {/* Required badge */}
      {document.required && (
        <div className="absolute top-4 right-4">
          <span className="text-xs font-medium text-red-500 dark:text-red-400">مطلوب *</span>
        </div>
      )}

      {/* Document info */}
      <div className="mt-8 mb-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-primary" />
        </div>
        <h4 className="font-bold text-foreground mb-1">{document.name}</h4>
        <p className="text-sm text-muted-foreground">{document.description}</p>
      </div>

      {/* File name if uploaded */}
      {document.fileName && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-4 truncate">
          📎 {document.fileName}
        </p>
      )}

      {/* Action button */}
      <Button
        size="sm"
        variant={document.status === 'uploaded' ? 'outline' : 'default'}
        className="w-full"
        onClick={() => document.status === 'uploaded' && onView ? onView(document.id) : onUpload(document.id)}
      >
        {document.status === 'uploaded' ? (
          <>
            <FileText className="w-4 h-4 ml-2" />
            عرض الملف
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 ml-2" />
            رفع الملف
          </>
        )}
      </Button>
    </motion.div>
  );
}
