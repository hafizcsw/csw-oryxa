import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const ACCEPTED_TYPES = ['.csv'];

interface FileUploaderProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploader({ file, onFileSelect, disabled }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && !f.name.endsWith('.csv')) {
      return; // silently reject non-CSV
    }
    onFileSelect(f);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 
                     flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-accent/30 
                     transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {t('admin.import.clickToUpload')}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {t('admin.import.csvOnly')}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 bg-accent/20 rounded-lg p-4 border">
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onFileSelect(null)}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
