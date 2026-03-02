import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import type { UsageReport, TeamMember } from './types';

export function getOrCreateMember(name: string): TeamMember {
  const db = getDb();
  const existing = db.prepare('SELECT id, name, created_at as createdAt FROM team_members WHERE name = ?').get(name) as TeamMember | undefined;
  if (existing) return existing;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO team_members (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now);
  return { id, name, createdAt: now };
}

export function insertUsageReport(report: UsageReport): void {
  const db = getDb();
  const member = getOrCreateMember(report.memberName);

  const stmt = db.prepare(`
    INSERT INTO usage_records (id, member_id, session_id, model, input_tokens, output_tokens,
      cache_creation_tokens, cache_read_tokens, cost_usd, project_name, recorded_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const r of report.records) {
    stmt.run(
      randomUUID(), member.id, report.sessionId, r.model,
      r.inputTokens, r.outputTokens, r.cacheCreationTokens, r.cacheReadTokens,
      r.costUsd, r.projectName, r.recordedAt, now
    );
  }
}

export function getAllMembers(): TeamMember[] {
  return getDb().prepare('SELECT id, name, created_at as createdAt FROM team_members ORDER BY name').all() as TeamMember[];
}

export interface DailyUsage {
  date: string;
  memberName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export function getDailyUsage(days: number = 30): DailyUsage[] {
  return getDb().prepare(`
    SELECT
      date(ur.recorded_at) as date,
      tm.name as memberName,
      ur.model,
      SUM(ur.input_tokens) as inputTokens,
      SUM(ur.output_tokens) as outputTokens,
      SUM(ur.cache_creation_tokens) as cacheCreationTokens,
      SUM(ur.cache_read_tokens) as cacheReadTokens,
      SUM(ur.cost_usd) as costUsd
    FROM usage_records ur
    JOIN team_members tm ON ur.member_id = tm.id
    WHERE ur.recorded_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(ur.recorded_at), tm.name, ur.model
    ORDER BY date DESC
  `).all(days) as DailyUsage[];
}

export function getMemberUsage(days: number = 30): { memberName: string; totalCost: number; totalTokens: number }[] {
  return getDb().prepare(`
    SELECT
      tm.name as memberName,
      SUM(ur.cost_usd) as totalCost,
      SUM(ur.input_tokens + ur.output_tokens) as totalTokens
    FROM usage_records ur
    JOIN team_members tm ON ur.member_id = tm.id
    WHERE ur.recorded_at >= datetime('now', '-' || ? || ' days')
    GROUP BY tm.name
    ORDER BY totalCost DESC
  `).all(days) as { memberName: string; totalCost: number; totalTokens: number }[];
}

export function getModelDistribution(days: number = 30): { model: string; count: number; totalCost: number }[] {
  return getDb().prepare(`
    SELECT
      model,
      COUNT(*) as count,
      SUM(cost_usd) as totalCost
    FROM usage_records
    WHERE recorded_at >= datetime('now', '-' || ? || ' days')
    GROUP BY model
    ORDER BY totalCost DESC
  `).all(days) as { model: string; count: number; totalCost: number }[];
}
