/**
 * Gallery Block Editor
 * Institution user proposes new gallery images.
 * Approved images are inserted into university_media (canonical source).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Send, Loader2, Plus, Trash2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GalleryImage {
  url: string;
  alt_text: string;
}

interface GalleryEditorProps {
  universityId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function GalleryEditor({ universityId, onClose, onSubmitted }: GalleryEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([{ url: '', alt_text: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setImages([...images, { url: '', alt_text: '' }]);
  const removeRow = (i: number) => setImages(images.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof GalleryImage, value: string) => {
    const updated = [...images];
    updated[i] = { ...updated[i], [field]: value };
    setImages(updated);
  };

  const validImages = images.filter(img => img.url.trim().startsWith('http'));

  const handleSubmit = async () => {
    if (validImages.length === 0) {
      toast({ title: t('institution.editor.galleryEmptyError'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('institution-page-edit', {
        body: {
          action: 'submit',
          university_id: universityId,
          block_type: 'gallery',
          payload: {
            images: validImages.map((img, i) => ({
              url: img.url.trim(),
              alt_text: img.alt_text.trim() || undefined,
              sort_order: 100 + i,
            })),
          },
        },
      });

      if (error || !data?.ok) {
        toast({
          title: t('institution.editor.submitError'),
          description: data?.error || error?.message,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: t('institution.editor.submitted') });
      onSubmitted();
    } catch {
      toast({ title: t('institution.editor.submitError'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">{t('institution.editor.galleryTitle')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('institution.editor.galleryDescription')}
          </p>

          {images.map((img, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Input
                  value={img.url}
                  onChange={(e) => updateRow(i, 'url', e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
                <Input
                  value={img.alt_text}
                  onChange={(e) => updateRow(i, 'alt_text', e.target.value)}
                  placeholder={t('institution.editor.altText')}
                />
              </div>
              {/* Preview */}
              <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {img.url.startsWith('http') ? (
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              {images.length > 1 && (
                <button onClick={() => removeRow(i)} className="p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> {t('institution.editor.addImage')}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {validImages.length} {t('institution.editor.imagesReady')}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              {t('institution.editor.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || validImages.length === 0} className="gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('institution.editor.submitForReview')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
