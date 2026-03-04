#!/usr/bin/env node

/**
 * ccusage-worv SessionEnd hook handler
 *
 * stdin으로 SessionEnd 데이터를 받아 JSONL 파싱 후 서버로 전송.
 * Node.js 내장 모듈만 사용 (외부 의존성 없음).
 */

import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import {
  loadConfig,
  loadSentSessions,
  saveSentSessions,
  parseJsonlFile,
  aggregateByModel,
  sendReport,
} from './lib/common.mjs';

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

  const projectName = basename(dirname(transcriptPath));
  records.forEach(r => { r.projectName = projectName; });

  const report = {
    memberName: config.memberName,
    sessionId,
    records,
    reportedAt: new Date().toISOString(),
  };

  try {
    await sendReport(config.serverUrl, report, config.apiKey);
    const sent = loadSentSessions();
    sent[sessionId] = new Date().toISOString();
    saveSentSessions(sent);
  } catch (err) {
    console.error('ccusage-worv: 전송 실패:', err.message);
  }
}

main();
