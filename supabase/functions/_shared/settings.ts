import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Get setting value from database first, fallback to environment variable
 * This allows settings to be edited directly from the UI while maintaining backward compatibility
 */
export async function getSetting(
  supabaseClient: SupabaseClient,
  key: string,
  fallbackEnvKey?: string
): Promise<string | null> {
  try {
    // First: Try to read from database
    const { data, error } = await supabaseClient
      .from('feature_settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (!error && data?.value) {
      // Handle different value formats
      if (typeof data.value === 'string') {
        return data.value;
      }
      // Handle JSONB with value field
      if (typeof data.value === 'object') {
        if (data.value.value) return String(data.value.value);
        if (data.value.url) return String(data.value.url);
      }
      // Return as string
      return String(data.value);
    }
    
    // Second: Fallback to environment variable for backward compatibility
    if (fallbackEnvKey) {
      const envValue = Deno.env.get(fallbackEnvKey);
      if (envValue) return envValue;
    }
    
    return null;
  } catch (err) {
    console.error(`Error getting setting ${key}:`, err);
    
    // Fallback to environment variable on error
    if (fallbackEnvKey) {
      return Deno.env.get(fallbackEnvKey) || null;
    }
    
    return null;
  }
}
