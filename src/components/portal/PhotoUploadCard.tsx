import { useState, useRef } from "react";
import { Camera, User, Eye, Download, Upload, Check, Loader2, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoUploadCardProps {
  existingPhotoUrl?: string | null;
  fileName?: string;
  uploadedAt?: string;
  status?: string;
  onUpload: (file: File) => Promise<boolean>;
  onPreview?: () => void;
  onDownload?: () => void;
  onDelete?: () => Promise<boolean>;
  uploading?: boolean;
  deleting?: boolean;
  disabled?: boolean;  // 🆕 Lock all interactions when docs_locked
}

export function PhotoUploadCard({
  existingPhotoUrl,
  fileName,
  uploadedAt,
  status,
  onUpload,
  onPreview,
  onDownload,
  onDelete,
  uploading = false,
  deleting = false,
  disabled = false,
}: PhotoUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect photo by fileName existence (CRM private buckets have null file_url)
  const hasPhoto = !!existingPhotoUrl || !!fileName;

  const handleFileSelect = async (file: File) => {
    if (disabled) return;  // 🆕 Block if locked
    if (!file.type.startsWith("image/")) return;
    await onUpload(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;  // 🆕 Block if locked
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const triggerUpload = () => {
    if (disabled) return;  // 🆕 Block if locked
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Photo Circle */}
      <div
        className="relative group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Main Circle */}
        <div
          className={cn(
            "w-32 h-32 rounded-full overflow-hidden transition-all duration-300 cursor-pointer",
            hasPhoto
              ? "border-4 border-primary/20 shadow-lg"
              : "border-4 border-dashed border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5",
            isDragOver && "border-primary scale-105 shadow-xl",
            uploading && "opacity-50"
          )}
          onClick={!uploading ? triggerUpload : undefined}
        >
          {hasPhoto ? (
            existingPhotoUrl ? (
              <img
                src={existingPhotoUrl}
                alt="صورة شخصية"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <User className="w-12 h-12 text-primary/60" />
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-12 h-12 text-primary/40" />
            </div>
          )}
        </div>

        {/* Uploading Overlay */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Action Bar - Always visible on mobile, hover on desktop */}
        {hasPhoto && !uploading && !deleting && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0",
            "bg-gradient-to-t from-black/80 via-black/50 to-transparent",
            "flex items-center justify-center gap-1 py-2 px-1",
            "transition-all duration-200",
            "sm:opacity-0 group-hover:opacity-100"
          )}>
            {onPreview && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
                title="عرض"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            )}
            {onDownload && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                title="تحميل"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                triggerUpload();
              }}
              disabled={disabled}
              title="استبدال"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full text-white hover:bg-destructive/80"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={disabled}
                title="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Deleting Overlay */}
        {deleting && (
          <div className="absolute inset-0 rounded-full bg-background/60 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-destructive animate-spin" />
          </div>
        )}

        {/* Success Badge */}
        {hasPhoto && !uploading && !deleting && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-2 border-background shadow-md">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Info Section - Clean without action buttons */}
      <div className="flex-1 space-y-2 text-center sm:text-right">
        {hasPhoto ? (
          <>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">تم رفع الصورة</span>
            </div>
            {fileName && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</p>
            )}
            {uploadedAt && (
              <p className="text-xs text-muted-foreground">
                تم الرفع: {new Date(uploadedAt).toLocaleDateString("ar-SA")}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm">
              <Upload className="w-4 h-4 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">مطلوب رفع صورة</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-none">
              <li>• خلفية بيضاء أو فاتحة</li>
              <li>• الوجه واضح ومباشر للكاميرا</li>
              <li>• بدون نظارات شمسية أو قبعات</li>
              <li>• بجودة عالية (JPG أو PNG)</li>
            </ul>
            <Button variant="outline" size="sm" onClick={triggerUpload} disabled={uploading || disabled}>
              <Camera className="w-4 h-4 ml-1" /> رفع صورة
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
