// ═══════════════════════════════════════════════════════════════
// Self-hosted Qwen client — INTERNAL ONLY
// ═══════════════════════════════════════════════════════════════
// HARD RULES:
//  - No OpenAI / Gemini / Mistral / Lovable AI Gateway.
//  - Reads INTERNAL_QWEN_ENDPOINT + INTERNAL_QWEN_TOKEN from env.
//  - If unconfigured/unreachable: returns a typed failure (never throws
//    a fake success).
//  - OpenAI-compatible /v1/chat/completions wire format with strict
//    JSON output.
// ═══════════════════════════════════════════════════════════════

export type QwenOutcome =
  | { ok: true; json: unknown; raw: string; model: string; ms: number }
  | { ok: false; reason: 'unconfigured' | 'unreachable' | 'invalid_json' | 'http_error'; detail: string; ms: number; model: string };

export interface QwenCallInput {
  systemPrompt: string;
  userPrompt: string;
  /** Hard cap on output tokens. */
  maxTokens?: number;
}

export async function callQwen(input: QwenCallInput): Promise<QwenOutcome> {
  const start = Date.now();
  const endpoint = Deno.env.get('INTERNAL_QWEN_ENDPOINT');
  const token = Deno.env.get('INTERNAL_QWEN_TOKEN');
  const model = Deno.env.get('INTERNAL_QWEN_MODEL') ?? 'qwen2.5-self-hosted';

  if (!endpoint || !token) {
    return {
      ok: false,
      reason: 'unconfigured',
      detail: 'INTERNAL_QWEN_ENDPOINT/TOKEN not set',
      ms: Date.now() - start,
      model,
    };
  }

  const url = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        temperature: 0,
        max_tokens: input.maxTokens ?? 1500,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: 'unreachable',
      detail: (e as Error).message ?? 'fetch_failed',
      ms: Date.now() - start,
      model,
    };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      ok: false,
      reason: 'http_error',
      detail: `${resp.status}:${text.slice(0, 300)}`,
      ms: Date.now() - start,
      model,
    };
  }

  let body: any;
  try {
    body = await resp.json();
  } catch (e) {
    return {
      ok: false,
      reason: 'invalid_json',
      detail: (e as Error).message ?? 'response_not_json',
      ms: Date.now() - start,
      model,
    };
  }

  const raw: string = body?.choices?.[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      reason: 'invalid_json',
      detail: `model_returned_non_json:${(e as Error).message}`,
      ms: Date.now() - start,
      model,
    };
  }

  return { ok: true, json: parsed, raw, model, ms: Date.now() - start };
}
