// Single source of truth for Claude model pricing (USD per 1M tokens)
export const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4-6':   { input: 5,  output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  'claude-sonnet-4-6': { input: 3,  output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5':  { input: 1,  output: 5,  cacheRead: 0.10, cacheWrite: 1.25 },
};

// Default fallback model for unknown model IDs
const DEFAULT_MODEL_KEY = 'claude-sonnet-4-6';

/**
 * Resolve a model ID (potentially with date suffix like "claude-haiku-4-5-20251001")
 * to a pricing map key using prefix matching.
 */
export function resolveModelKey(model: string): string {
  if (MODEL_PRICING[model]) return model;
  // Try prefix matching: find the longest key that is a prefix of the model ID
  const keys = Object.keys(MODEL_PRICING);
  const match = keys
    .filter(key => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match || DEFAULT_MODEL_KEY;
}

/**
 * Calculate cost in USD from token counts and model ID.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0,
): number {
  const key = resolveModelKey(model);
  const pricing = MODEL_PRICING[key];
  return (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    cacheCreationTokens * pricing.cacheWrite +
    cacheReadTokens * pricing.cacheRead
  ) / 1_000_000;
}
