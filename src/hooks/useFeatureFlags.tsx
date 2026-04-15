import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type FeatureFlags = {
  "recs.enabled": boolean;
  "scholarships.enabled": boolean;
  "email.enabled": boolean;
  "compare.enabled": boolean;
  "counselor.enabled": boolean;
};

const defaultFlags: FeatureFlags = {
  "recs.enabled": true,
  "scholarships.enabled": true,
  "email.enabled": false,
  "compare.enabled": true,
  "counselor.enabled": true,
};

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlags();
  }, []);

  async function loadFlags() {
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, enabled");

      if (error) {
        console.error("Error loading feature flags:", error);
        return;
      }

      const loadedFlags = { ...defaultFlags };
      data?.forEach((flag) => {
        if (flag.key in loadedFlags) {
          loadedFlags[flag.key as keyof FeatureFlags] = flag.enabled;
        }
      });

      setFlags(loadedFlags);
    } catch (error) {
      console.error("Error in loadFlags:", error);
    } finally {
      setLoading(false);
    }
  }

  return { flags, loading };
}
