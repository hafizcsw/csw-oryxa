/**
 * Facebook-style Cover/Logo Editor
 * - Cover: 820×312 aspect ratio, full-width preview with repositioning
 * - Logo: Circular preview with border
 * - File upload to storage bucket, not URL input
 * - Preview before submitting for review
 */
import { useState, useRef, useCallback } from 'react';
import { X, Loader2, Camera, Upload, Check, RotateCcw, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { universitySocialBridge } from '@/lib/university-page/bridge';

interface CoverLogoEditorProps {
  universityId: string;
  mode: 'cover' | 'logo';
  currentUrl?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const COVER_ASPECT = 820 / 312; // Facebook cover aspect ratio ~2.63:1
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function CoverLogoEditor({ universityId, mode, currentUrl, onClose, onSubmitted }: CoverLogoEditorProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOffset, setDragOffset] = useState(50); // cover vertical position %

  // Drag-to-reposition state (cover only)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(50);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: t('institution.editor.fb.invalidType'), variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: t('institution.editor.fb.fileTooLarge'), variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setDragOffset(50);
  }, [t, toast]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'cover' || !previewUrl) return;
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartOffset.current = dragOffset;
  }, [mode, previewUrl, dragOffset]);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = clientY - dragStartY.current;
    const newOffset = Math.max(0, Math.min(100, dragStartOffset.current + delta * 0.3));
    setDragOffset(newOffset);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetImage = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setDragOffset(50);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setSubmitting(true);

    try {
      // 1. Upload to storage
      setUploading(true);
      const ext = selectedFile.name.split('.').pop() || 'jpg';
      const storagePath = `${universityId}/${mode}-${Date.now()}.${ext}`;
      const bucket = mode === 'cover' ? 'university-media' : 'university-logos';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;
      setUploading(false);

      // 2. Submit through governance bridge
      const response = mode === 'cover'
        ? await universitySocialBridge.updateUniversityPageCover(universityId, { coverImageUrl: publicUrl })
        : await universitySocialBridge.updateUniversityPageLogo(universityId, { logoUrl: publicUrl });

      if (!response.ok) {
        toast({ title: t('institution.editor.submitFailure'), variant: 'destructive' });
        return;
      }

      if (response.autoPublished) {
        toast({
          title: t('institution.editor.fb.published'),
          description: t('institution.editor.fb.publishedDesc'),
        });
        // Reload page to reflect the change immediately
        onSubmitted();
        window.location.reload();
      } else {
        toast({
          title: t('institution.editor.fb.submitted'),
          description: t('institution.editor.fb.submittedDesc'),
        });
        onSubmitted();
      }
    } catch (err) {
      toast({ title: t('institution.editor.submitFailure'), description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const isCover = mode === 'cover';
  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-base font-semibold text-foreground">
            {t(isCover ? 'institution.editor.fb.editCoverTitle' : 'institution.editor.fb.editLogoTitle')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {previewUrl && (
            <Button variant="ghost" size="sm" onClick={resetImage} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              {t('institution.editor.fb.reset')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedFile || submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? t('institution.editor.fb.uploading') : t('institution.editor.fb.submitting')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('institution.editor.fb.save')}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
        {isCover ? (
          /* ===== COVER PREVIEW ===== */
          <div className="w-full max-w-[940px]">
            <div
              className="relative w-full rounded-xl overflow-hidden border-2 border-border/50 shadow-2xl"
              style={{ aspectRatio: `${COVER_ASPECT}` }}
              onMouseDown={previewUrl ? handleDragStart : undefined}
              onMouseMove={isDragging ? handleDragMove : undefined}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={previewUrl ? handleDragStart : undefined}
              onTouchMove={isDragging ? handleDragMove : undefined}
              onTouchEnd={handleDragEnd}
            >
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                  style={{ objectPosition: `center ${dragOffset}%` }}
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <Camera className="w-12 h-12 text-muted-foreground/40" />
                </div>
              )}

              {/* Drag hint overlay */}
              {previewUrl && (
                <div
                  className="absolute inset-0 flex items-center justify-center transition-opacity"
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <div className={`bg-black/60 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 transition-opacity ${isDragging ? 'opacity-0' : 'opacity-70 hover:opacity-100'}`}>
                    <ZoomIn className="w-4 h-4" />
                    {t('institution.editor.fb.dragToReposition')}
                  </div>
                </div>
              )}

              {/* Upload button overlay */}
              {!previewUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 hover:bg-black/10 transition-colors group"
                >
                  <div className="w-14 h-14 rounded-full bg-black/40 group-hover:bg-black/60 flex items-center justify-center transition-colors">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-white text-sm font-medium bg-black/40 px-4 py-1.5 rounded-full">
                    {t('institution.editor.fb.uploadCover')}
                  </span>
                </button>
              )}
            </div>

            {/* Change photo button (when preview exists) */}
            {previewUrl && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {t('institution.editor.fb.chooseAnother')}
                </Button>
              </div>
            )}

            {/* Dimensions hint */}
            <p className="text-center text-xs text-muted-foreground mt-3">
              {t('institution.editor.fb.coverDimensionsHint')}
            </p>
          </div>
        ) : (
          /* ===== LOGO PREVIEW ===== */
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] rounded-full overflow-hidden border-4 border-card shadow-2xl bg-muted">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Camera overlay button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 end-2 w-10 h-10 rounded-full bg-muted border-2 border-card shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
              >
                <Camera className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {/* Name label under logo — like Facebook */}
            <p className="text-lg font-semibold text-foreground">
              {t('institution.editor.fb.profilePhoto')}
            </p>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {t('institution.editor.fb.logoDimensionsHint')}
            </p>
          </div>
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="px-4 py-3 bg-card/95 backdrop-blur border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          {t('institution.editor.governanceHint')}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
