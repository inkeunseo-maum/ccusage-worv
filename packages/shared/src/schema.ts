export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  project_name TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES team_members(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_member ON usage_records(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);
`;
