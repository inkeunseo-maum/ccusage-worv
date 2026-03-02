import { supabase } from './db';
import type { UsageReport, TeamMember } from './types';

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

  if (error) throw error;
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
