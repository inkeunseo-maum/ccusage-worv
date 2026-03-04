// Supabase SQL Editor에서 실행할 마이그레이션 SQL
export const MIGRATION_SQL = `
-- ============================================
-- Tables
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES team_members(id),
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  project_name TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES team_members(id),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('weekly', 'monthly')),
  budget_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, budget_type)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usage_member ON usage_records(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);

-- ============================================
-- RPC Functions
-- ============================================

-- Daily usage aggregation by member and model
CREATE OR REPLACE FUNCTION get_daily_usage(since_date TIMESTAMPTZ)
RETURNS TABLE (
  date TEXT,
  "memberName" TEXT,
  model TEXT,
  "inputTokens" BIGINT,
  "outputTokens" BIGINT,
  "cacheCreationTokens" BIGINT,
  "cacheReadTokens" BIGINT,
  "costUsd" DOUBLE PRECISION
) AS $$
  SELECT
    to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    tm.name AS "memberName",
    ur.model,
    SUM(ur.input_tokens)::BIGINT AS "inputTokens",
    SUM(ur.output_tokens)::BIGINT AS "outputTokens",
    SUM(ur.cache_creation_tokens)::BIGINT AS "cacheCreationTokens",
    SUM(ur.cache_read_tokens)::BIGINT AS "cacheReadTokens",
    SUM(ur.cost_usd) AS "costUsd"
  FROM usage_records ur
  JOIN team_members tm ON tm.id = ur.member_id
  WHERE ur.recorded_at >= since_date
  GROUP BY date, tm.name, ur.model
  ORDER BY date;
$$ LANGUAGE sql STABLE;

-- Per-member total usage
CREATE OR REPLACE FUNCTION get_member_usage(since_date TIMESTAMPTZ)
RETURNS TABLE (
  "memberName" TEXT,
  "totalCost" DOUBLE PRECISION,
  "totalTokens" BIGINT
) AS $$
  SELECT
    tm.name AS "memberName",
    SUM(ur.cost_usd) AS "totalCost",
    SUM(ur.input_tokens + ur.output_tokens)::BIGINT AS "totalTokens"
  FROM usage_records ur
  JOIN team_members tm ON tm.id = ur.member_id
  WHERE ur.recorded_at >= since_date
  GROUP BY tm.name
  ORDER BY "totalCost" DESC;
$$ LANGUAGE sql STABLE;

-- Model distribution
CREATE OR REPLACE FUNCTION get_model_distribution(since_date TIMESTAMPTZ)
RETURNS TABLE (
  model TEXT,
  count BIGINT,
  "totalCost" DOUBLE PRECISION
) AS $$
  SELECT
    ur.model,
    COUNT(*)::BIGINT AS count,
    SUM(ur.cost_usd) AS "totalCost"
  FROM usage_records ur
  WHERE ur.recorded_at >= since_date
  GROUP BY ur.model
  ORDER BY "totalCost" DESC;
$$ LANGUAGE sql STABLE;

-- Member budget usage for a given period
CREATE OR REPLACE FUNCTION get_member_budget_usage(period_type TEXT, period_start TIMESTAMPTZ)
RETURNS TABLE (
  "memberId" UUID,
  "memberName" TEXT,
  "budgetUsd" DOUBLE PRECISION,
  "usedUsd" DOUBLE PRECISION,
  "usagePercent" DOUBLE PRECISION
) AS $$
  SELECT
    tm.id AS "memberId",
    tm.name AS "memberName",
    COALESCE(bc.budget_usd, team_bc.budget_usd, 0) AS "budgetUsd",
    COALESCE(usage.total_cost, 0) AS "usedUsd",
    CASE
      WHEN COALESCE(bc.budget_usd, team_bc.budget_usd, 0) > 0
      THEN (COALESCE(usage.total_cost, 0) / COALESCE(bc.budget_usd, team_bc.budget_usd, 0)) * 100
      ELSE 0
    END AS "usagePercent"
  FROM team_members tm
  LEFT JOIN budget_configs bc ON bc.member_id = tm.id AND bc.budget_type = period_type
  LEFT JOIN budget_configs team_bc ON team_bc.member_id IS NULL AND team_bc.budget_type = period_type
  LEFT JOIN (
    SELECT member_id, SUM(cost_usd) AS total_cost
    FROM usage_records
    WHERE recorded_at >= period_start
    GROUP BY member_id
  ) usage ON usage.member_id = tm.id
  ORDER BY "usedUsd" DESC;
$$ LANGUAGE sql STABLE;

-- Usage velocity (daily average over last 7 days)
CREATE OR REPLACE FUNCTION get_usage_velocity(since_date TIMESTAMPTZ)
RETURNS TABLE (
  "memberId" UUID,
  "memberName" TEXT,
  "dailyAvgUsd" DOUBLE PRECISION,
  "activeDays" BIGINT
) AS $$
  SELECT
    tm.id AS "memberId",
    tm.name AS "memberName",
    CASE
      WHEN COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')) > 0
      THEN SUM(ur.cost_usd) / COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
      ELSE 0
    END AS "dailyAvgUsd",
    COUNT(DISTINCT to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'))::BIGINT AS "activeDays"
  FROM team_members tm
  LEFT JOIN usage_records ur ON ur.member_id = tm.id AND ur.recorded_at >= since_date
  GROUP BY tm.id, tm.name;
$$ LANGUAGE sql STABLE;

-- Upsert budget configuration
CREATE OR REPLACE FUNCTION upsert_budget(p_member_id UUID, p_budget_type TEXT, p_budget_usd DOUBLE PRECISION)
RETURNS VOID AS $$
BEGIN
  INSERT INTO budget_configs (member_id, budget_type, budget_usd, updated_at)
  VALUES (p_member_id, p_budget_type, p_budget_usd, now())
  ON CONFLICT (member_id, budget_type)
  DO UPDATE SET budget_usd = EXCLUDED.budget_usd, updated_at = now();
END;
$$ LANGUAGE plpgsql;
`;
