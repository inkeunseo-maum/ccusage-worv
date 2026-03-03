import { supabase } from './db';
import type { UsageReport, TeamMember, MemberBudgetUsage, UsageVelocity, BudgetConfig } from './types';

export async function getOrCreateMember(name: string): Promise<TeamMember> {
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, name, created_at')
    .eq('name', name)
    .single();

  if (existing) {
    return { id: existing.id, name: existing.name, createdAt: existing.created_at };
  }

  const { data: created, error } = await supabase
    .from('team_members')
    .insert({ name })
    .select('id, name, created_at')
    .single();

  // Race condition: 동시 요청으로 이미 생성된 경우 다시 조회
  if (error) {
    const { data: retry } = await supabase
      .from('team_members')
      .select('id, name, created_at')
      .eq('name', name)
      .single();
    if (retry) {
      return { id: retry.id, name: retry.name, createdAt: retry.created_at };
    }
    throw error;
  }
  return { id: created!.id, name: created!.name, createdAt: created!.created_at };
}

export async function insertUsageReport(report: UsageReport): Promise<void> {
  const member = await getOrCreateMember(report.memberName);

  const rows = report.records.map((r) => ({
    member_id: member.id,
    session_id: report.sessionId,
    model: r.model,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    cache_creation_tokens: r.cacheCreationTokens,
    cache_read_tokens: r.cacheReadTokens,
    cost_usd: r.costUsd,
    project_name: r.projectName,
    recorded_at: r.recordedAt,
  }));

  // 같은 세션의 기존 레코드 삭제 후 삽입 (중복 방지)
  await supabase
    .from('usage_records')
    .delete()
    .eq('session_id', report.sessionId)
    .eq('member_id', member.id);

  const { error } = await supabase.from('usage_records').insert(rows);
  if (error) throw error;
}

export async function getAllMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, created_at')
    .order('name');

  if (error) throw error;
  return (data || []).map((m) => ({ id: m.id, name: m.name, createdAt: m.created_at }));
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

export async function getDailyUsage(days: number = 30): Promise<DailyUsage[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase.rpc('get_daily_usage', { since_date: since });
  if (error) throw error;
  return data || [];
}

export async function getMemberUsage(days: number = 30): Promise<{ memberName: string; totalCost: number; totalTokens: number }[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase.rpc('get_member_usage', { since_date: since });
  if (error) throw error;
  return data || [];
}

export async function getModelDistribution(days: number = 30): Promise<{ model: string; count: number; totalCost: number }[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase.rpc('get_model_distribution', { since_date: since });
  if (error) throw error;
  return data || [];
}

// 예산 관련 함수

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // 월요일 기준
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMemberBudgetUsage(budgetType: 'weekly' | 'monthly'): Promise<MemberBudgetUsage[]> {
  const periodStart = budgetType === 'weekly' ? getWeekStart() : getMonthStart();

  const { data, error } = await supabase.rpc('get_member_budget_usage', {
    period_type: budgetType,
    period_start: periodStart.toISOString(),
  });
  if (error) throw error;
  return data || [];
}

export async function getUsageVelocity(): Promise<UsageVelocity[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data, error } = await supabase.rpc('get_usage_velocity', { since_date: since });
  if (error) throw error;
  return data || [];
}

export async function upsertBudget(memberId: string | null, budgetType: 'weekly' | 'monthly', budgetUsd: number): Promise<void> {
  const { error } = await supabase.rpc('upsert_budget', {
    p_member_id: memberId,
    p_budget_type: budgetType,
    p_budget_usd: budgetUsd,
  });
  if (error) throw error;
}

export async function getAllBudgets(): Promise<BudgetConfig[]> {
  const { data, error } = await supabase
    .from('budget_configs')
    .select('id, member_id, budget_type, budget_usd')
    .order('budget_type');

  if (error) throw error;
  return (data || []).map((b) => ({
    id: b.id,
    memberId: b.member_id,
    budgetType: b.budget_type as 'weekly' | 'monthly',
    budgetUsd: b.budget_usd,
  }));
}
