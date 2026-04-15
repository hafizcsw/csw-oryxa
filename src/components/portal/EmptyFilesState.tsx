import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface EmptyFilesStateProps {
  onUploadClick: () => void;
}

export default function EmptyFilesState({ onUploadClick }: EmptyFilesStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="relative mb-6">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <Upload className="w-24 h-24 mx-auto text-muted-foreground/30" />
        </motion.div>
      </div>
      <h3 className="text-xl font-bold mb-2 text-foreground">لم يتم رفع أي ملفات بعد</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        ابدأ برفع مستنداتك للمتابعة في عملية التسجيل
      </p>
      <Button 
        size="lg" 
        className="bg-gradient-primary hover-lift shadow-colored"
        onClick={onUploadClick}
      >
        <Upload className="ml-2 w-5 h-5" />
        رفع أول ملف
      </Button>
    </motion.div>
  );
}
