import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdate(true);
      });
    }
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed bottom-4 right-4 z-50 bg-card p-4 rounded-xl shadow-elegant border border-border"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-foreground mb-1">نسخة جديدة متوفرة!</p>
              <p className="text-sm text-muted-foreground">انقر لتحديث الصفحة</p>
            </div>
            <Button 
              onClick={handleUpdate} 
              size="sm"
              className="bg-gradient-primary hover-lift"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
