import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Replace, FileText, ImageIcon, Loader2, CheckCircle2, Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StudentDocument } from "@/hooks/useStudentDocuments";

interface DocumentUploadSlotProps {
  category: string;
  label: string;
  required?: boolean;
  hint?: string;
  existingDocument?: StudentDocument | null;
  onUpload: (file: File) => Promise<boolean>;
  uploading?: boolean;
  accept?: string;
  variant?: "default" | "add-new";
}

export function DocumentUploadSlot({
  category,
  label,
  required,
  hint,
  existingDocument,
  onUpload,
  uploading,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  variant = "default",
}: DocumentUploadSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isPreviewable = (fileName: string) => {
    return /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(fileName);
  };

  const isPdf = (fileName: string) => {
    return /\.pdf$/i.test(fileName);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onUpload(file);
    }
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
  };

  const hasDocument = existingDocument && existingDocument.file_name;

  // Variant: add-new (always shows upload button)
  if (variant === "add-new") {
    return (
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={uploading}
          className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              جاري الرفع...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 ml-2" />
              إضافة ملف جديد
            </>
          )}
        </Button>
        {hint && (
          <p className="text-xs text-muted-foreground mt-2">{hint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="text-sm font-medium text-foreground block">
        {label}
        {required && <span className="text-destructive mr-1">*</span>}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {hasDocument ? (
        // Document exists - show info + actions
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {isImage(existingDocument.file_name) ? (
                <ImageIcon className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <p className="font-medium text-sm">{existingDocument.file_name}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                تم الرفع: {new Date(existingDocument.uploaded_at).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {existingDocument.signed_url && isPreviewable(existingDocument.file_name) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="gap-1 text-xs px-2 py-1 h-auto"
              >
                <Eye className="h-3 w-3" />
                معاينة
              </Button>
            )}
            {existingDocument.signed_url && (
              <a
                href={existingDocument.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3 w-3" />
                تحميل
              </a>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={uploading}
              className="gap-1"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Replace className="h-3 w-3" />
              )}
              استبدال
            </Button>
          </div>
        </div>
      ) : (
        // No document - show upload area
        <div
          onClick={handleClick}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer
            transition-colors duration-200
            ${dragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">جاري الرفع...</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">اضغط للرفع أو اسحب الملف هنا</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF أو صور (JPG, PNG)
              </p>
            </>
          )}
        </div>
      )}

      {hint && !hasDocument && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {/* Preview Modal */}
      {hasDocument && existingDocument?.signed_url && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b border-border">
              <DialogTitle>{existingDocument.file_name}</DialogTitle>
            </DialogHeader>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {isPdf(existingDocument.file_name) ? (
                <iframe 
                  src={existingDocument.signed_url} 
                  className="w-full h-[70vh] rounded-lg border border-border"
                  title={existingDocument.file_name}
                />
              ) : (
                <img 
                  src={existingDocument.signed_url} 
                  alt={existingDocument.file_name}
                  className="max-w-full h-auto mx-auto rounded-lg"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
