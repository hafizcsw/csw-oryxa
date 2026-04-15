import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket: string;
  path: string;
  maxSize?: number; // in MB
  aspectRatio?: "square" | "wide" | "auto";
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUploader({
  value,
  onChange,
  bucket,
  path,
  maxSize = 9,
  aspectRatio = "auto",
  placeholder = "اسحب الصورة هنا أو انقر للاختيار",
  className,
  disabled = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClass = {
    square: "aspect-square",
    wide: "aspect-video",
    auto: "min-h-[150px]",
  }[aspectRatio];

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("يرجى اختيار ملف صورة صالح");
        return;
      }

      // Validate file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSize) {
        toast.error(`حجم الملف يجب أن يكون أقل من ${maxSize}MB`);
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        clearInterval(progressInterval);

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        setProgress(100);
        onChange(urlData.publicUrl);
        toast.success("تم رفع الصورة بنجاح");
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(error.message || "فشل في رفع الصورة");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [bucket, path, maxSize, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || uploading) return;

      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [disabled, uploading, handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input
    e.target.value = "";
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer transition-all",
          aspectRatioClass,
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed",
          uploading && "pointer-events-none"
        )}
      >
        {/* Current Image Preview */}
        {value && !uploading && (
          <>
            <img
              src={value}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleClick}
                className="gap-1"
              >
                <Upload className="h-4 w-4" />
                تغيير
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemove}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                حذف
              </Button>
            </div>
          </>
        )}

        {/* Empty State / Upload Zone */}
        {!value && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
            <p className="text-sm text-center">{placeholder}</p>
            <p className="text-xs text-center">
              الحد الأقصى: {maxSize}MB
            </p>
          </div>
        )}

        {/* Uploading State */}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-background/80">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">جاري الرفع...</p>
            <Progress value={progress} className="w-3/4 h-2" />
          </div>
        )}
      </div>
    </div>
  );
}
