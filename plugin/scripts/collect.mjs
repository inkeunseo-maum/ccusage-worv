#!/usr/bin/env node

/**
 * ccusage-worv SessionEnd hook handler
 *
 * stdin으로 SessionEnd 데이터를 받아 JSONL 파싱 후 서버로 전송.
 * Node.js 내장 모듈만 사용 (외부 의존성 없음).
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

// --- Config ---

const CONFIG_PATH = join(homedir(), '.ccusage-worv.json');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

// --- Pricing (USD per 1M tokens) ---

const MODEL_PRICING = {
  'claude-opus-4-6':   { input: 15,   output: 75,  cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3,    output: 15,  cacheRead: 0.3,  cacheWrite: 3.75  },
  'claude-haiku-4-5':  { input: 0.8,  output: 4,   cacheRead: 0.08, cacheWrite: 1     },
};

function estimateCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-sonnet-4-6'];
  return (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    cacheCreationTokens * pricing.cacheWrite +
    cacheReadTokens * pricing.cacheRead
  ) / 1_000_000;
}

// --- Parser ---
// Claude Code JSONL 형식: model과 usage는 message 객체 안에 중첩,
// 필드명은 snake_case (input_tokens, cache_creation_input_tokens 등)

function parseJsonlFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const entries = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const msg = parsed.message;
      if (msg && msg.model && msg.usage && msg.usage.input_tokens !== undefined) {
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

function aggregateByModel(entries) {
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

  // 집계 후 비용 계산
  for (const record of byModel.values()) {
    record.costUsd = estimateCost(
      record.model, record.inputTokens, record.outputTokens,
      record.cacheCreationTokens, record.cacheReadTokens
    );
  }

  return Array.from(byModel.values());
}

// --- Sender ---

async function sendReport(serverUrl, report, apiKey) {
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

// --- Stdin ---

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 1000);
  });
}

// --- Main ---

async function main() {
  const config = loadConfig();
  if (!config) {
    console.error('ccusage-worv: 설정이 없습니다. /ccusage-worv:init을 먼저 실행하세요.');
    process.exit(0); // hook에서는 non-zero exit을 피함
  }

  let sessionId = 'unknown';
  let transcriptPath = '';

  try {
    const raw = await readStdin();
    if (raw.trim()) {
      const input = JSON.parse(raw);
      sessionId = input.session_id;
      transcriptPath = input.transcript_path;
    }
  } catch {
    // stdin 없이 실행된 경우
  }

  if (!transcriptPath) {
    return;
  }

  if (!existsSync(transcriptPath)) {
    return;
  }

  const entries = parseJsonlFile(transcriptPath);
  if (entries.length === 0) return;

  const records = aggregateByModel(entries);

  const projectName = basename(dirname(dirname(transcriptPath)));
  records.forEach(r => { r.projectName = projectName; });

  const report = {
    memberName: config.memberName,
    sessionId,
    records,
    reportedAt: new Date().toISOString(),
  };

  try {
    await sendReport(config.serverUrl, report, config.apiKey);
  } catch (err) {
    console.error('ccusage-worv: 전송 실패:', err.message);
  }
}

main();
