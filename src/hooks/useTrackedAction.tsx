import { useState, useCallback } from "react";
import { captureTelemetry } from "@/lib/telemetry";
import { toast } from "sonner";

interface UseTrackedActionOptions {
  buttonId: string;
  action: () => Promise<void> | void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  context?: Record<string, any>;
}

/**
 * Unified hook for tracked button actions
 * Handles loading, disabled, error states and telemetry
 */
export function useTrackedAction({
  buttonId,
  action,
  onSuccess,
  onError,
  successMessage,
  errorMessage = "An error occurred",
  context = {}
}: UseTrackedActionOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      // Track button click
      await captureTelemetry('button_clicked', {
        button_id: buttonId,
        timestamp: new Date().toISOString(),
        ...context
      });

      // Execute action
      await action();

      // Track success
      const latency = Math.round(performance.now() - startTime);
      await captureTelemetry('button_action_success', {
        button_id: buttonId,
        latency_ms: latency,
        ...context
      });

      if (successMessage) {
        toast.success(successMessage);
      }

      onSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      // Track error
      const latency = Math.round(performance.now() - startTime);
      await captureTelemetry('button_action_error', {
        button_id: buttonId,
        error: error.message,
        latency_ms: latency,
        ...context
      });

      toast.error(errorMessage);
      onError?.(error);
      
      console.error(`[useTrackedAction] ${buttonId} failed:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [buttonId, action, onSuccess, onError, successMessage, errorMessage, context, isLoading]);

  return {
    execute,
    isLoading,
    error,
    disabled: isLoading
  };
}
