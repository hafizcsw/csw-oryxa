import React, { useState } from 'react';
import type { University } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Heart, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterValidPrograms, getProgramDisplayInfo, getProgramId } from '@/lib/program/validators';

interface ChatUniversitiesPanelProps {
  universities: University[];
  onCompareRequest?: (selectedIds: string[]) => void;
}

export const ChatUniversitiesPanel: React.FC<ChatUniversitiesPanelProps> = ({
  universities,
  onCompareRequest,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const validUniversities = filterValidPrograms(universities);
  if (!validUniversities || validUniversities.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleCompareClick = () => {
    if (onCompareRequest && selectedIds.length >= 2) {
      onCompareRequest(selectedIds);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDuration = (months: number) => {
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) {
        return `${years} سنة`;
      }
      return `${years} سنة و ${remainingMonths} شهر`;
    }
    return `${months} شهر`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          البرامج المقترحة بناءً على حديثك مع ملاك
        </span>
        {selectedIds.length > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {selectedIds.length} / 5 مختارة
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {validUniversities.map((u) => {
          const programId = getProgramId(u);
          const info = getProgramDisplayInfo(u);
          const isSelected = selectedIds.includes(programId);
          return (
            <div
              key={programId}
              className={cn(
                "min-w-[240px] max-w-[280px] rounded-xl border bg-card p-4 flex flex-col justify-between shadow-sm transition-all duration-200",
                isSelected && "border-primary ring-2 ring-primary/20"
              )}
            >
              <div className="space-y-2">
                <div className="font-semibold text-sm line-clamp-2 text-foreground">
                  {info.programName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {info.universityName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {info.countryName}
                </div>
                
                <div className="flex items-center gap-3 text-xs pt-1">
                  {info.fees > 0 && (
                    <span className="text-primary font-medium">
                      {formatPrice(info.fees)}
                    </span>
                  )}
                  {info.duration > 0 && (
                    <span className="text-muted-foreground">
                      {formatDuration(info.duration)}
                    </span>
                  )}
                  {info.language && (
                    <span className="text-muted-foreground">
                      {info.language}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  type="button"
                  size="icon"
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn(
                    'rounded-full w-9 h-9 transition-all',
                    isSelected && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => toggleSelect(programId)}
                >
                  <Heart className={cn("h-4 w-4", isSelected && "fill-current")} />
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs gap-1"
                  onClick={() => {
                    window.open(`/programs/${programId}`, '_blank');
                  }}
                >
                  التفاصيل
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedIds.length >= 2 && (
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleCompareClick}
            className="gap-2"
          >
            مقارنة هذه الجامعات ({selectedIds.length})
          </Button>
        </div>
      )}
    </div>
  );
};
