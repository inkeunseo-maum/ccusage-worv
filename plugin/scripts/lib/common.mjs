/**
 * ccusage-worv 공유 모듈
 *
 * catchup.mjs, collect.mjs, init.mjs에서 공통으로 사용하는 유틸리티.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// --- Paths ---

export const CONFIG_PATH = join(homedir(), '.ccusage-worv.json');
export const SENT_PATH = join(homedir(), '.ccusage-worv-sent.json');
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// --- Config ---

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

// --- Sent Sessions ---

export function loadSentSessions() {
  if (!existsSync(SENT_PATH)) return {};
  try { return JSON.parse(readFileSync(SENT_PATH, 'utf-8')); } catch { return {}; }
}

export function saveSentSessions(sent) {
  writeFileSync(SENT_PATH, JSON.stringify(sent, null, 2));
}

// --- Pricing (USD per 1M tokens) ---

export const MODEL_PRICING = {
  'claude-opus-4-6':   { input: 5,  output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
  'claude-sonnet-4-6': { input: 3,  output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-haiku-4-5':  { input: 1,  output: 5,  cacheRead: 0.10, cacheWrite: 1.25 },
};

export function resolveModelKey(model) {
  if (MODEL_PRICING[model]) return model;
  const keys = Object.keys(MODEL_PRICING);
  const match = keys
    .filter(key => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match || 'claude-sonnet-4-6';
}

export function estimateCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens) {
  const key = resolveModelKey(model);
  const pricing = MODEL_PRICING[key];
  return (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    cacheCreationTokens * pricing.cacheWrite +
    cacheReadTokens * pricing.cacheRead
  ) / 1_000_000;
}

// --- Parser ---

export function parseJsonlFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const entries = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const msg = parsed.message;
      if (msg && msg.model && msg.usage && msg.usage.input_tokens !== undefined) {
        if (msg.model === '<synthetic>' || msg.model === '') continue;
        entries.push({
          model: msg.model,
          usage: msg.usage,
          timestamp: parsed.timestamp,
        });
      }
    } catch {
      // skip malformed lines
    }
  }

  return entries;
}

export function aggregateByModel(entries) {
  const byModel = new Map();

  for (const entry of entries) {
    const usage = entry.usage;
    if (!usage) continue;

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    const existing = byModel.get(entry.model);
    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.cacheCreationTokens += cacheCreationTokens;
      existing.cacheReadTokens += cacheReadTokens;
      if (entry.timestamp > existing.recordedAt) {
        existing.recordedAt = entry.timestamp;
      }
    } else {
      byModel.set(entry.model, {
        model: entry.model,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        costUsd: 0,
        projectName: '',
        recordedAt: entry.timestamp,
      });
    }
  }

  for (const record of byModel.values()) {
    record.costUsd = estimateCost(
      record.model, record.inputTokens, record.outputTokens,
      record.cacheCreationTokens, record.cacheReadTokens
    );
  }

  return Array.from(byModel.values());
}

// --- Sender ---

export async function sendReport(serverUrl, report, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${serverUrl}/api/usage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(report),
  });

  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}: ${await res.text()}`);
  }
}
