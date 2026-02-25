import { readFileSync } from 'node:fs';
import type { ClaudeUsageEntry, UsageRecord } from '@ccusage-worv/shared';

export function parseJsonlFile(filePath: string): ClaudeUsageEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const entries: ClaudeUsageEntry[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.model && parsed.usage) {
        entries.push(parsed);
      }
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

export function aggregateByModel(entries: ClaudeUsageEntry[]): UsageRecord[] {
  const byModel = new Map<string, UsageRecord>();

  for (const entry of entries) {
    if (!entry.usage) continue;

    const existing = byModel.get(entry.model);
    if (existing) {
      existing.inputTokens += entry.usage.inputTokens || 0;
      existing.outputTokens += entry.usage.outputTokens || 0;
      existing.cacheCreationTokens += entry.usage.cacheCreationInputTokens || 0;
      existing.cacheReadTokens += entry.usage.cacheReadInputTokens || 0;
      existing.costUsd += entry.costUSD || 0;
    } else {
      byModel.set(entry.model, {
        model: entry.model,
        inputTokens: entry.usage.inputTokens || 0,
        outputTokens: entry.usage.outputTokens || 0,
        cacheCreationTokens: entry.usage.cacheCreationInputTokens || 0,
        cacheReadTokens: entry.usage.cacheReadInputTokens || 0,
        costUsd: entry.costUSD || 0,
        projectName: '',
        recordedAt: entry.timestamp,
      });
    }
  }

  return Array.from(byModel.values());
}
