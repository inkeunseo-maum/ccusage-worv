#!/usr/bin/env node

/**
 * ccusage-worv Catch-up 스크립트
 *
 * SessionStart에서 실행되어 미전송 세션을 찾아 전송합니다.
 * 비정상 종료(컴퓨터 꺼짐 등)로 SessionEnd가 실행되지 못한 세션을 보완합니다.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  CLAUDE_PROJECTS_DIR, loadConfig, loadSentSessions,
  saveSentSessions, parseJsonlFile, aggregateByModel, sendReport,
  fetchUtilization,
} from './lib/common.mjs';

// 7일 이내 세션만 catch-up (너무 오래된 건 무시)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// --- Scanner ---

export function findUnsentTranscripts(sentSessions) {
  const unsent = [];
  const cutoff = Date.now() - MAX_AGE_MS;

  if (!existsSync(CLAUDE_PROJECTS_DIR)) return unsent;

  const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(CLAUDE_PROJECTS_DIR, d.name));

  for (const projDir of projectDirs) {
    const projectName = basename(projDir);
    let files;
    try {
      files = readdirSync(projDir).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      if (sentSessions[sessionId]) continue;

      const filePath = join(projDir, file);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) continue;
        // 현재 실행 중인 세션은 건너뛰기 (최근 60초 이내 수정된 파일)
        if (Date.now() - stat.mtimeMs < 60_000) continue;

        unsent.push({ sessionId, filePath, projectName });
      } catch {
        continue;
      }
    }
  }

  return unsent;
}

// --- Catchup Runner (init.mjs에서도 사용) ---

export async function runCatchup(configOverride) {
  const config = configOverride || loadConfig();
  if (!config) return { success: false, total: 0 };

  const sent = loadSentSessions();
  const unsent = findUnsentTranscripts(sent);

  if (unsent.length === 0) return { success: true, total: 0 };

  const utilization = await fetchUtilization();

  let successCount = 0;

  for (const { sessionId, filePath, projectName } of unsent) {
    try {
      const entries = parseJsonlFile(filePath);
      if (entries.length === 0) {
        sent[sessionId] = 'empty';
        continue;
      }

      const records = aggregateByModel(entries);
      records.forEach(r => { r.projectName = projectName; });

      const report = {
        memberName: config.memberName, sessionId, records,
        reportedAt: new Date().toISOString(),
        ...(utilization && { utilization }),
      };

      await sendReport(config.serverUrl, report, config.apiKey);
      sent[sessionId] = new Date().toISOString();
      successCount++;
    } catch (err) {
      console.error(`ccusage-worv: catch-up 전송 실패 (${sessionId}):`, err.message);
    }
  }

  saveSentSessions(sent);

  return { success: true, total: successCount };
}

// --- Main (직접 실행 시에만) ---

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun) {
  const { total } = await runCatchup();
  if (total > 0) {
    console.error(`ccusage-worv: ${total}개 미전송 세션 catch-up 완료`);
  }
}
