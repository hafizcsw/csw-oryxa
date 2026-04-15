import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentChannel {
  id: string;
  channel_type: 'bank_transfer' | 'paypal' | 'usdt' | 'wise' | 'payment_link' | 'other';
  display_name: string;
  instructions: string;
  details: Record<string, string> | null;
  currency: string;
  country_scope?: string | null;
  is_active: boolean;
}

export function usePaymentChannels(countryCode?: string) {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, [countryCode]);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const result = await supabase.functions.invoke('student-portal-api', {
        body: {
          action: 'list_payment_channels',
          country_code: countryCode,
        }
      });

      if (result.data?.ok) {
        setChannels(result.data.data || []);
      } else if (result.data?.error === 'FEATURE_NOT_AVAILABLE') {
        console.warn('[usePaymentChannels] Feature not available');
        setChannels([]);
      } else {
        setError(result.data?.message || 'فشل تحميل قنوات الدفع');
      }
    } catch (err) {
      console.error('[usePaymentChannels] Error:', err);
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  return { channels, loading, error, refetch: loadChannels };
}
