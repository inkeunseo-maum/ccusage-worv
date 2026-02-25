import { loadConfig } from './config.js';
import { parseJsonlFile, aggregateByModel } from './parser.js';
import { sendReport } from './sender.js';
import { basename, dirname } from 'node:path';
import type { SessionEndInput, UsageReport } from '@ccusage-worv/shared';

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 1000);
  });
}

export async function collect(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('설정이 없습니다. ccusage-worv init을 먼저 실행하세요.');
    process.exit(1);
  }

  let sessionId = 'unknown';
  let transcriptPath = '';
  try {
    const raw = await readStdin();
    if (raw.trim()) {
      const input: SessionEndInput = JSON.parse(raw);
      sessionId = input.session_id;
      transcriptPath = input.transcript_path;
    }
  } catch {
    // stdin 없이 실행된 경우 (수동 테스트)
  }

  let files: string[] = [];
  if (transcriptPath) {
    files = [transcriptPath];
  }

  if (files.length === 0) {
    console.error('파싱할 JSONL 파일을 찾을 수 없습니다.');
    return;
  }

  const allEntries = files.flatMap(f => parseJsonlFile(f));
  if (allEntries.length === 0) return;

  const records = aggregateByModel(allEntries);

  const projectName = transcriptPath
    ? basename(dirname(dirname(transcriptPath)))
    : 'unknown';
  records.forEach(r => { r.projectName = projectName; });

  const report: UsageReport = {
    memberName: config.memberName,
    sessionId,
    records,
    reportedAt: new Date().toISOString(),
  };

  try {
    await sendReport(config.serverUrl, report, config.apiKey);
  } catch (err) {
    console.error('전송 실패:', err);
  }
}
