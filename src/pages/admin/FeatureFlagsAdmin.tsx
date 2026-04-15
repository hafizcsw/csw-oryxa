import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flag, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export default function FeatureFlagsAdmin() {
  const queryClient = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_settings')
        .select('*')
        .like('key', 'feature.%')
        .order('key');
      
      if (error) throw error;
      return data as FeatureFlag[];
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, newValue }: { key: string; newValue: boolean }) => {
      const { error } = await supabase
        .from('feature_settings')
        .update({ value: newValue ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success(`Feature ${variables.newValue ? 'enabled' : 'disabled'}`);
    },
    onError: (error) => {
      toast.error(`Failed to toggle feature: ${error.message}`);
    }
  });

  const getFeatureStatus = (flag: FeatureFlag) => {
    const isEnabled = flag.value === 'true';
    return {
      enabled: isEnabled,
      variant: (isEnabled ? 'default' : 'secondary') as 'default' | 'secondary',
      label: isEnabled ? 'ON' : 'OFF'
    };
  };

  const getFeatureName = (key: string) => {
    return key.replace('feature.', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Feature Flags</h1>
            <p className="text-muted-foreground mt-2">
              Control feature rollout and system behavior
            </p>
          </div>
          <Flag className="w-8 h-8 text-primary" />
        </div>

        <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                Rollout Strategy
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                All features are OFF by default. Enable gradually starting with DE (Germany) only.
                Monitor metrics for 24 hours before expanding to other countries.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          {flags?.map((flag) => {
            const status = getFeatureStatus(flag);
            
            return (
              <Card key={flag.key} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {getFeatureName(flag.key)}
                      </h3>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </div>
                    
                    {flag.description && (
                      <p className="text-sm text-muted-foreground">
                        {flag.description}
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(flag.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <Switch
                    checked={status.enabled}
                    onCheckedChange={(checked) => {
                      toggleMutation.mutate({ key: flag.key, newValue: checked });
                    }}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
          <div className="space-y-3">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Feature Dependencies
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Enable <code>fetch_chain</code> before <code>double_validation</code></li>
              <li>Enable <code>price_normalization</code> before <code>freshness_badges</code></li>
              <li><code>golden_set</code> requires sufficient test data</li>
              <li><code>auto_alerts</code> monitors other features (enable last)</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
