// ═══════════════════════════════════════════════════════════════
// ORYXA AI Provider Policy (Order 3R)
// ───────────────────────────────────────────────────────────────
// Centralizes provider mode + provider selection for ORYXA AI.
// Mistral is fully disabled. DeepSeek API is the transitional
// production provider until ORYXA local/self-hosted is ready.
// ═══════════════════════════════════════════════════════════════

export type ProviderMode =
  | "deepseek_api_transitional"
  | "internal_only_future"
  | "disabled";

export type OryxaAIProvider =
  | "deepseek_api"
  | "oryxa_local_deepseek_future"
  | "local_mock"
  | "disabled";

export type OryxaAITask =
  | "document_extraction"
  | "file_readiness_evaluation"
  | "russian_translation_draft";

export interface ResolvedPolicy {
  mode: ProviderMode;
  provider: OryxaAIProvider;
  model: string;
  /** True when the resolved provider can actually be invoked at runtime. */
  enabled: boolean;
  /** Reason returned to caller when enabled === false. */
  blocked_reason?:
    | "local_ai_provider_not_configured"
    | "external_ai_provider_disabled"
    | "deepseek_api_key_missing"
    | "provider_mode_disabled";
}

/**
 * Reads ORYXA_AI_PROVIDER_MODE / ORYXA_AI_PROVIDER / DEEPSEEK_API_KEY
 * from edge runtime env and resolves the active policy.
 *
 * Defaults (when env is unset) intentionally favour the transitional
 * DeepSeek path so preview/dev can run, while still failing closed
 * if the key is missing.
 */
export function resolvePolicy(env: {
  ORYXA_AI_PROVIDER_MODE?: string | null;
  ORYXA_AI_PROVIDER?: string | null;
  ORYXA_AI_MODEL?: string | null;
  DEEPSEEK_API_KEY?: string | null;
}): ResolvedPolicy {
  const rawMode = (env.ORYXA_AI_PROVIDER_MODE ?? "deepseek_api_transitional").trim();
  const rawProv = (env.ORYXA_AI_PROVIDER ?? "deepseek_api").trim();
  const model = (env.ORYXA_AI_MODEL ?? "deepseek-v4-flash").trim();

  const mode: ProviderMode =
    rawMode === "internal_only_future" || rawMode === "disabled" || rawMode === "deepseek_api_transitional"
      ? (rawMode as ProviderMode)
      : "deepseek_api_transitional";

  const provider: OryxaAIProvider =
    rawProv === "oryxa_local_deepseek_future" ||
    rawProv === "local_mock" ||
    rawProv === "disabled" ||
    rawProv === "deepseek_api"
      ? (rawProv as OryxaAIProvider)
      : "deepseek_api";

  if (mode === "disabled" || provider === "disabled") {
    return { mode, provider, model, enabled: false, blocked_reason: "provider_mode_disabled" };
  }

  if (mode === "internal_only_future") {
    // Local/self-hosted ORYXA provider is not implemented yet.
    return {
      mode,
      provider,
      model,
      enabled: false,
      blocked_reason: "local_ai_provider_not_configured",
    };
  }

  // mode === "deepseek_api_transitional"
  if (provider === "deepseek_api") {
    if (!env.DEEPSEEK_API_KEY) {
      return { mode, provider, model, enabled: false, blocked_reason: "deepseek_api_key_missing" };
    }
    return { mode, provider, model, enabled: true };
  }

  // local_mock / oryxa_local_deepseek_future under transitional mode
  return {
    mode,
    provider,
    model,
    enabled: false,
    blocked_reason: "local_ai_provider_not_configured",
  };
}

/** Hard prohibition: external providers must never receive raw student docs. */
export const RAW_DOCUMENT_EXTERNAL_TRANSFER_BLOCKED = "raw_document_external_transfer_blocked" as const;

/** DeepSeek (current provider) does NOT support raw document upload. */
export function deepseekSupportsRawDocument(): false {
  return false;
}
