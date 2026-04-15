import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import type { RussianAssessmentSection } from '@/types/russianAssessmentExecution';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';

interface Props {
  section: RussianAssessmentSection;
  answers: Record<string, string>;
  onChange: (itemKey: string, value: string) => void;
  disabled?: boolean;
}

export function AssessmentSectionRenderer({ section, answers, onChange, disabled }: Props) {
  const { t } = useLanguage();
  const formatBlockType = (value: string) => translateLanguageCourseValue(t, `languages.assessment.blockTypes.${value}`, value);
  const formatPromptType = (value: string) => translateLanguageCourseValue(t, `languages.assessment.promptTypes.${value}`, value);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t(section.titleKey)}</h3>
          <p className="text-sm text-muted-foreground">{t('languages.assessment.sectionItemsLabel', { count: section.itemCount })}</p>
        </div>
      </div>

      {section.contentBlocks?.length ? (
        <div className="space-y-3">
          {section.contentBlocks.map((block) => (
            <div key={block.blockKey} className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{formatBlockType(block.type)}</p>
              {block.title ? <p className="text-sm font-semibold text-foreground">{block.title}</p> : null}
              <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">{block.content}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {section.items.map((item) => (
          <div key={item.itemKey} className="rounded-xl border border-border/80 bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('languages.assessment.itemLabel', { index: item.ordinal })}</p>
                {item.lessonTitle && (
                  <p className="text-xs text-muted-foreground mt-1">{t('languages.assessment.lessonFocusLabel', { lesson: item.lessonTitle })}</p>
                )}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{formatPromptType(item.promptType)}</p>
            </div>
            <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">{item.prompt}</p>
            <Textarea
              value={answers[item.itemKey] ?? ''}
              onChange={(event) => onChange(item.itemKey, event.target.value)}
              disabled={disabled}
              rows={item.promptType === 'written_response' ? 5 : 3}
              placeholder={t('languages.assessment.answerPlaceholder')}
              className="resize-y"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
