-- One-time migration: Recalculate cost_usd for all existing usage_records
--
-- Problem: Previous plugin versions used incorrect pricing:
--   - claude-opus-4-6:   was $15/$75 input/output → correct: $5/$25
--   - claude-haiku-4-5:  was $0.80/$4 input/output → correct: $1/$5
--   - claude-sonnet-4-6: was correct ($3/$15)
--   - Cache pricing was also wrong for opus and haiku
--
-- This migration recalculates all cost_usd values using correct pricing.
-- Run this ONCE in Supabase SQL Editor after deploying the updated code.
--
-- Correct pricing (USD per 1M tokens):
--   claude-opus-4-6:   input=$5,  output=$25, cache_read=$0.50, cache_write=$6.25
--   claude-sonnet-4-6: input=$3,  output=$15, cache_read=$0.30, cache_write=$3.75
--   claude-haiku-4-5:  input=$1,  output=$5,  cache_read=$0.10, cache_write=$1.25

UPDATE usage_records
SET cost_usd = (
  CASE
    -- Exact match
    WHEN model = 'claude-opus-4-6' THEN
      (input_tokens * 5.0 + output_tokens * 25.0 + cache_creation_tokens * 6.25 + cache_read_tokens * 0.50) / 1000000.0
    WHEN model = 'claude-sonnet-4-6' THEN
      (input_tokens * 3.0 + output_tokens * 15.0 + cache_creation_tokens * 3.75 + cache_read_tokens * 0.30) / 1000000.0
    WHEN model = 'claude-haiku-4-5' THEN
      (input_tokens * 1.0 + output_tokens * 5.0 + cache_creation_tokens * 1.25 + cache_read_tokens * 0.10) / 1000000.0
    -- Prefix match for date-suffixed model IDs (e.g., claude-haiku-4-5-20251001)
    WHEN model LIKE 'claude-opus-4-6-%' THEN
      (input_tokens * 5.0 + output_tokens * 25.0 + cache_creation_tokens * 6.25 + cache_read_tokens * 0.50) / 1000000.0
    WHEN model LIKE 'claude-sonnet-4-6-%' THEN
      (input_tokens * 3.0 + output_tokens * 15.0 + cache_creation_tokens * 3.75 + cache_read_tokens * 0.30) / 1000000.0
    WHEN model LIKE 'claude-haiku-4-5-%' THEN
      (input_tokens * 1.0 + output_tokens * 5.0 + cache_creation_tokens * 1.25 + cache_read_tokens * 0.10) / 1000000.0
    -- Fallback: use sonnet pricing for unknown models
    ELSE
      (input_tokens * 3.0 + output_tokens * 15.0 + cache_creation_tokens * 3.75 + cache_read_tokens * 0.30) / 1000000.0
  END
)
WHERE model != '<synthetic>';

-- Clean up: remove any <synthetic> records that may exist
DELETE FROM usage_records WHERE model = '<synthetic>';

-- Verify: check the results
SELECT
  model,
  COUNT(*) as record_count,
  ROUND(SUM(cost_usd)::numeric, 2) as total_cost_usd
FROM usage_records
GROUP BY model
ORDER BY total_cost_usd DESC;
