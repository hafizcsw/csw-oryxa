import { useEffect, useState } from "react";

type Settings = Record<string, { enabled?: boolean; [key: string]: any }>;

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-settings`,
          { method: "POST" }
        );
        const json = await res.json();
        setSettings(json.settings || {});
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { settings, loading };
}
