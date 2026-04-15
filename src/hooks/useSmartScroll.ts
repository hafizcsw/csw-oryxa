import { useRef, useEffect, useCallback } from 'react';

interface UseSmartScrollOptions {
  messagesCount: number;
  isTyping: boolean;      // state === 'thinking' || state === 'searching'
  hasNewMessage: boolean; // آخر رسالة isNew=true
}

export function useSmartScroll(options: UseSmartScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(options.messagesCount);
  const isUserScrolledUp = useRef(false);
  
  // دالة التمرير للأسفل
  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      const el = scrollRef.current;
      // Double RAF للتأكد من تحديث DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTo({
            top: el.scrollHeight,
            behavior
          });
        });
      });
    }
  }, []);

  // تتبع إذا المستخدم رفع للأعلى يدوياً
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // إذا المستخدم بعيد أكثر من 100px عن الأسفل
      isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
    }
  }, []);

  // Reset user scroll flag when new message arrives
  const resetUserScroll = useCallback(() => {
    isUserScrolledUp.current = false;
  }, []);

  // تمرير عند إضافة رسالة جديدة
  useEffect(() => {
    if (options.messagesCount > prevCountRef.current) {
      resetUserScroll(); // Reset so we scroll to new messages
      scrollToBottom('auto'); // تمرير فوري للرسائل الجديدة
    }
    prevCountRef.current = options.messagesCount;
  }, [options.messagesCount, scrollToBottom, resetUserScroll]);

  // تمرير عند بدء الكتابة/البحث
  useEffect(() => {
    if (options.isTyping) {
      scrollToBottom('smooth');
    }
  }, [options.isTyping, scrollToBottom]);

  // تمرير تدريجي أثناء typewriter effect
  useEffect(() => {
    if (options.hasNewMessage) {
      const interval = setInterval(() => {
        scrollToBottom('auto');
      }, 100); // كل 100ms أثناء الكتابة
      
      return () => clearInterval(interval);
    }
  }, [options.hasNewMessage, scrollToBottom]);

  return { scrollRef, scrollToBottom, handleScroll, resetUserScroll };
}
