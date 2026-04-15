import { FileText, Download, FileCheck, FileClock, File, FileImage, FileSpreadsheet, Sparkles, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassIcon } from "@/components/ui/glass-icon";
import { glassColors, GlassColorVariant } from "@/lib/glass-colors";

interface ReadyFile {
  id: string;
  file_name: string;
  file_kind: string;
  title?: string;
  status?: string;
  storage_bucket: string;
  storage_path: string;
}

interface ReadyFilesGridProps {
  files: ReadyFile[];
  onDownload: (storageBucket: string, storagePath: string) => void;
}

const fileIcons: Record<string, { 
  icon: LucideIcon; 
  variant: GlassColorVariant;
  label: string;
}> = {
  acceptance: { icon: FileCheck, variant: 'success', label: 'خطاب القبول' },
  passport: { icon: FileText, variant: 'info', label: 'جواز السفر' },
  certificate: { icon: FileText, variant: 'purple', label: 'الشهادة' },
  visa: { icon: FileCheck, variant: 'warning', label: 'التأشيرة' },
  ticket: { icon: FileText, variant: 'danger', label: 'التذكرة' },
  photo: { icon: FileImage, variant: 'info', label: 'صورة' },
  transcript: { icon: FileSpreadsheet, variant: 'purple', label: 'كشف الدرجات' },
  contract: { icon: FileText, variant: 'primary', label: 'العقد' },
  receipt: { icon: FileText, variant: 'success', label: 'الإيصال' },
  default: { icon: File, variant: 'neutral', label: 'ملف' }
};

export function ReadyFilesGrid({ files, onDownload }: ReadyFilesGridProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 25 }
    }
  };

  if (files.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden text-center py-16 bg-card/50 backdrop-blur-xl rounded-3xl border-2 border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-transparent" />
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <GlassIcon 
            icon={FileClock}
            variant="neutral"
            size="xl"
            className="mx-auto mb-4"
          />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-semibold text-foreground"
        >
          لا توجد ملفات جاهزة حالياً
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground mt-1"
        >
          ستظهر ملفاتك هنا عند جهوزيتها للتحميل
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {files.map((file) => {
        const fileType = fileIcons[file.file_kind] || fileIcons.default;
        const FileIcon = fileType.icon;
        const colors = glassColors[fileType.variant];

        return (
          <motion.div
            key={file.id}
            variants={item}
            whileHover={{ scale: 1.03, y: -4 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl p-5",
              "bg-card/50 backdrop-blur-xl border-2 transition-all duration-500",
              colors.border,
              "hover:shadow-xl cursor-pointer"
            )}
            onClick={() => onDownload(file.storage_bucket, file.storage_path)}
          >
            {/* Animated Background */}
            <motion.div 
              className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                `bg-gradient-to-br ${colors.bg}`
              )}
            />

            {/* Shimmer Effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <motion.div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ translateX: ['100%', '-100%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
              />
            </div>

            {/* Ready Sparkle */}
            <motion.div
              className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
            </motion.div>

            {/* Top Decorative Orb */}
            <motion.div 
              className={cn(
                "absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity",
                `bg-gradient-to-br ${colors.gradient}`
              )}
            />

            <div className="relative flex items-start gap-4">
              {/* Glass Icon */}
              <GlassIcon 
                icon={FileIcon}
                variant={fileType.variant}
                size="lg"
                glow
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate text-base">
                  {file.title || file.file_name}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {fileType.label}
                </p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Badge 
                    className={cn(
                      "mt-3 text-xs border-2 px-2.5 py-1",
                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    )}
                  >
                    <FileCheck className="h-3 w-3 mr-1" />
                    جاهز للتحميل
                  </Badge>
                </motion.div>
              </div>

              {/* Download Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-300"
              >
                <Button
                  size="icon"
                  className={cn(
                    "h-11 w-11 rounded-xl",
                    "bg-gradient-to-br from-primary to-primary/80",
                    "shadow-lg hover:shadow-xl transition-all"
                  )}
                >
                  <Download className="h-5 w-5 text-primary-foreground" />
                </Button>
              </motion.div>
            </div>

            {/* Bottom Glow Line */}
            <div className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              `bg-gradient-to-r ${colors.gradient}`
            )} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
