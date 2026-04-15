import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getShortlistCount, onShortlistChanged } from "@/lib/shortlistStore";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Apply Now Bar - Shows selected universities count
 * 
 * If logged in → navigate to /account to complete profile
 * If not logged in → navigate to /auth?mode=signup
 */
export function ApplyNowBar() {
  const [count, setCount] = useState(() => getShortlistCount());
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  useEffect(() => {
    setCount(getShortlistCount());
    const unsubscribe = onShortlistChanged((event) => {
      setCount(event.count);
    });
    return unsubscribe;
  }, []);
  
  if (count <= 0) return null;

  const handleApply = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/account?tab=profile");
    } else {
      navigate("/auth?mode=signup");
    }
  };
  
  return (
    <div 
      className="sticky bottom-0 bg-background border-t border-border p-2.5 px-3 flex gap-2 justify-between items-center z-10"
    >
      <div className="text-foreground">
        {t('applyBar.selected', { defaultValue: 'الجامعات المختارة' })}: <b>{count}</b> / 5
      </div>
      <button 
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
        onClick={handleApply}
      >
        {t('applyBar.applyNow', { defaultValue: 'التقديم الآن' })}
      </button>
    </div>
  );
}
