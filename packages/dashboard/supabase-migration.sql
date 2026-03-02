-- ccusage-worv Supabase 마이그레이션
-- Supabase SQL Editor에서 실행하세요

-- 1. 테이블 생성
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

CREATE INDEX IF NOT EXISTS idx_usage_member ON usage_records(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);

-- 2. RPC 함수: 일별 사용량
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
) LANGUAGE sql STABLE AS $$
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
  JOIN team_members tm ON ur.member_id = tm.id
  WHERE ur.recorded_at >= since_date
  GROUP BY to_char(ur.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), tm.name, ur.model
  ORDER BY date DESC;
$$;

-- 3. RPC 함수: 팀원별 사용량
CREATE OR REPLACE FUNCTION get_member_usage(since_date TIMESTAMPTZ)
RETURNS TABLE (
  "memberName" TEXT,
  "totalCost" DOUBLE PRECISION,
  "totalTokens" BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    tm.name AS "memberName",
    SUM(ur.cost_usd) AS "totalCost",
    SUM(ur.input_tokens + ur.output_tokens)::BIGINT AS "totalTokens"
  FROM usage_records ur
  JOIN team_members tm ON ur.member_id = tm.id
  WHERE ur.recorded_at >= since_date
  GROUP BY tm.name
  ORDER BY "totalCost" DESC;
$$;

-- 4. RPC 함수: 모델 분포
CREATE OR REPLACE FUNCTION get_model_distribution(since_date TIMESTAMPTZ)
RETURNS TABLE (
  model TEXT,
  count BIGINT,
  "totalCost" DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    model,
    COUNT(*)::BIGINT AS count,
    SUM(cost_usd) AS "totalCost"
  FROM usage_records
  WHERE recorded_at >= since_date
  GROUP BY model
  ORDER BY "totalCost" DESC;
$$;

-- 5. RLS 비활성화 (서버 사이드에서만 접근하므로)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- service_role 키로 접근하므로 RLS 바이패스됨
