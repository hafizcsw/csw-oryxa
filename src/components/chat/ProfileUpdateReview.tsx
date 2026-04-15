/**
 * PORTAL-5: Profile Autofill Review UI
 * Shows detected profile updates from chat for user confirmation
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Edit2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ProfileUpdate {
  field: string;
  label: string;
  value: string;
  confidence: number; // 0-1
}

interface ProfileUpdateReviewProps {
  updates: ProfileUpdate[];
  onConfirm: (confirmedUpdates: ProfileUpdate[]) => void;
  onDismiss: () => void;
}

export function ProfileUpdateReview({ updates, onConfirm, onDismiss }: ProfileUpdateReviewProps) {
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(
    new Set(updates.filter(u => u.confidence >= 0.8).map(u => u.field))
  );

  if (updates.length === 0) return null;

  const toggleUpdate = (field: string) => {
    const next = new Set(selectedUpdates);
    if (next.has(field)) {
      next.delete(field);
    } else {
      next.add(field);
    }
    setSelectedUpdates(next);
  };

  const handleConfirm = () => {
    const confirmed = updates.filter(u => selectedUpdates.has(u.field));
    onConfirm(confirmed);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl border border-blue-200 dark:border-blue-800 p-4 shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">تحديثات من المحادثة</h4>
            <p className="text-xs text-muted-foreground">اكتشفنا بعض المعلومات - راجعها قبل الحفظ</p>
          </div>
        </div>

        {/* Updates List */}
        <div className="space-y-2 mb-4">
          {updates.map((update) => (
            <motion.div
              key={update.field}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                selectedUpdates.has(update.field)
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                  : 'bg-white/50 dark:bg-white/5 border-border hover:border-blue-200'
              }`}
              onClick={() => toggleUpdate(update.field)}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                selectedUpdates.has(update.field)
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-muted-foreground/30'
              }`}>
                {selectedUpdates.has(update.field) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>

              {/* Field Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{update.label}</div>
                <div className="font-medium text-foreground truncate">{update.value}</div>
              </div>

              {/* Confidence Badge */}
              {update.confidence < 0.8 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  تحقق
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={selectedUpdates.size === 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Check className="w-4 h-4 ml-1" />
            تأكيد ({selectedUpdates.size})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
