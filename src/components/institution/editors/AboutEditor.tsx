/**
 * About Block Editor
 * Institution user proposes changes to the university's About text.
 * Changes go through review → approve → publish to canonical universities table.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AboutEditorProps {
  universityId: string;
  currentAbout?: string;
  currentDescriptionAr?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function AboutEditor({ universityId, currentAbout, currentDescriptionAr, onClose, onSubmitted }: AboutEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [aboutText, setAboutText] = useState(currentAbout || '');
  const [descriptionAr, setDescriptionAr] = useState(currentDescriptionAr || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!aboutText.trim() && !descriptionAr.trim()) {
      toast({ title: t('institution.editor.emptyError'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('institution-page-edit', {
        body: {
          action: 'submit',
          university_id: universityId,
          block_type: 'about',
          payload: {
            about_text: aboutText.trim() || undefined,
            description_ar: descriptionAr.trim() || undefined,
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
    } catch (err) {
      toast({ title: t('institution.editor.submitError'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">{t('institution.editor.aboutTitle')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('institution.editor.aboutDescription')}
          </p>

          <div className="space-y-2">
            <Label>{t('institution.editor.aboutTextLabel')}</Label>
            <Textarea
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              rows={6}
              placeholder={t('institution.editor.aboutPlaceholder')}
              className="resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('institution.editor.aboutTextArLabel')}</Label>
            <Textarea
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              rows={6}
              dir="rtl"
              placeholder={t('institution.editor.aboutArPlaceholder')}
              className="resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('institution.editor.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('institution.editor.submitForReview')}
          </Button>
        </div>
      </div>
    </div>
  );
}
