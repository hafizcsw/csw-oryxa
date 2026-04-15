/**
 * #7.3 Shortlist Limit Modal
 * Shown when user tries to add 11th program (limit = 10)
 */
import { Heart, BarChart3, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ShortlistItem } from '@/lib/portalApi';

interface ShortlistLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: ShortlistItem[];
  onCompare: () => void;
  onManage: () => void;
}

export function ShortlistLimitModal({
  open,
  onOpenChange,
  items = [],
  onCompare,
  onManage,
}: ShortlistLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
          </div>
          <DialogTitle className="text-xl font-bold text-center">
            وصلت للحد الأقصى! 🎯
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground mt-2 leading-relaxed">
            لديك {items.length || 10} برامج في المفضلة. هذا هو الحد الأقصى للمقارنة الفعّالة.
            <br />
            <span className="font-medium text-foreground">هل تريد مقارنة البرامج الآن؟</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {/* Primary: Compare */}
          <Button
            onClick={() => {
              onCompare();
              onOpenChange(false);
            }}
            className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-medium"
          >
            <BarChart3 className="w-5 h-5" />
            قارن الآن
          </Button>

          {/* Secondary: Manage */}
          <Button
            variant="outline"
            onClick={() => {
              onManage();
              onOpenChange(false);
            }}
            className="w-full h-11 gap-2"
          >
            <List className="w-4 h-4" />
            إدارة المفضلة
          </Button>

          {/* Tertiary: Cancel */}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
          >
            لاحقاً
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
