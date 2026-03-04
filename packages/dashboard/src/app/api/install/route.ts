import { NextResponse } from 'next/server';

export async function GET() {
  const script = generateInstallScript();
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

function generateInstallScript(): string {
  return `#!/bin/bash
set -e

NAME="\$1"
if [ -z "\$NAME" ]; then
  echo ""
  echo "ccusage-worv 설치 스크립트"
  echo "========================="
  echo ""
  echo "사용법:"
  echo "  curl -sL https://ccusage-worv.vercel.app/api/install | bash -s -- \\"이름\\""
  echo ""
  echo "예시:"
  echo "  curl -sL https://ccusage-worv.vercel.app/api/install | bash -s -- \\"홍길동\\""
  echo ""
  exit 1
fi

PLUGIN_DIR="\$HOME/.claude/plugins/cache/worv/ccusage-worv/0.1.0"

echo ""
echo "ccusage-worv 설치 시작..."
echo ""

# --- 디렉토리 생성 ---
mkdir -p "\$PLUGIN_DIR/scripts/lib"
mkdir -p "\$PLUGIN_DIR/commands"
mkdir -p "\$PLUGIN_DIR/hooks"
mkdir -p "\$PLUGIN_DIR/.claude-plugin"

# --- plugin.json ---
cat > "\$PLUGIN_DIR/.claude-plugin/plugin.json" << 'PLUGINJSON'
{
  "name": "ccusage-worv",
  "version": "0.1.0",
  "description": "Claude Code 팀 사용량 자동 수집 플러그인. SessionEnd hook으로 토큰/비용 데이터를 중앙 서버에 전송.",
  "author": { "name": "inkeunseo-maum" },
  "repository": "https://github.com/inkeunseo-maum/ccusage-worv"
}
PLUGINJSON

# --- hooks.json ---
cat > "\$PLUGIN_DIR/hooks/hooks.json" << 'HOOKSJSON'
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \\"\${CLAUDE_PLUGIN_ROOT}/scripts/catchup.mjs\\"",
            "timeout": 30
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \\"\${CLAUDE_PLUGIN_ROOT}/scripts/collect.mjs\\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
HOOKSJSON

# --- commands/init.md ---
cat > "\$PLUGIN_DIR/commands/init.md" << 'INITMD'
---
name: init
description: ccusage-worv 초기 설정 (팀원 이름, 플러그인 활성화, 과거 데이터 backfill)
---

ccusage-worv 플러그인 초기 설정을 진행합니다.

사용자에게 **팀원 이름**(대시보드에 표시될 이름, 예: 홍길동)만 물어보세요.

정보를 받으면 아래 명령어를 실행하세요:

\\\`\\\`\\\`bash
node "\${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<이름>"
\\\`\\\`\\\`

실행하면 3단계가 자동으로 수행됩니다:

1. **설정 저장**: ~/.ccusage-worv.json에 이름과 서버 URL 저장
2. **플러그인 활성화**: ~/.claude/settings.json의 enabledPlugins에 등록
3. **과거 데이터 backfill**: 최근 7일 이내의 미전송 세션을 서버에 전송

설정이 완료되면 Claude Code 세션 시작/종료 시 자동으로 사용량이 서버에 전송됩니다.
INITMD

# --- commands/sync.md ---
cat > "\$PLUGIN_DIR/commands/sync.md" << 'SYNCMD'
---
name: sync
description: 미전송 세션을 수동으로 서버에 전송합니다
---

ccusage-worv 미전송 세션을 수동으로 catch-up 합니다.

아래 명령어를 실행하세요:

\\\`\\\`\\\`bash
node "\${CLAUDE_PLUGIN_ROOT}/scripts/catchup.mjs"
\\\`\\\`\\\`

실행 결과를 사용자에게 알려주세요.
SYNCMD

# --- scripts/lib/common.mjs ---
cat > "\$PLUGIN_DIR/scripts/lib/common.mjs" << 'COMMONMJS'
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CONFIG_PATH = join(homedir(), '.ccusage-worv.json');
export const SENT_PATH = join(homedir(), '.ccusage-worv-sent.json');
export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

export function loadSentSessions() {
  if (!existsSync(SENT_PATH)) return {};
  try { return JSON.parse(readFileSync(SENT_PATH, 'utf-8')); } catch { return {}; }
}

export function saveSentSessions(sent) {
  writeFileSync(SENT_PATH, JSON.stringify(sent, null, 2));
}

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

export function parseJsonlFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\\n').filter(line => line.trim());
  const entries = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const msg = parsed.message;
      if (msg && msg.model && msg.usage && msg.usage.input_tokens !== undefined) {
        if (msg.model === '<synthetic>' || msg.model === '') continue;
        entries.push({ model: msg.model, usage: msg.usage, timestamp: parsed.timestamp });
      }
    } catch {}
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
    } else {
      byModel.set(entry.model, {
        model: entry.model, inputTokens, outputTokens,
        cacheCreationTokens, cacheReadTokens, costUsd: 0,
        projectName: '', recordedAt: entry.timestamp,
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

export async function sendReport(serverUrl, report, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
  const res = await fetch(serverUrl + '/api/usage', {
    method: 'POST', headers, body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error('Server responded with ' + res.status + ': ' + await res.text());
}
COMMONMJS

# --- scripts/catchup.mjs ---
cat > "\$PLUGIN_DIR/scripts/catchup.mjs" << 'CATCHUPMJS'
#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  CLAUDE_PROJECTS_DIR, loadConfig, loadSentSessions,
  saveSentSessions, parseJsonlFile, aggregateByModel, sendReport,
} from './lib/common.mjs';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function findUnsentTranscripts(sentSessions) {
  const unsent = [];
  const cutoff = Date.now() - MAX_AGE_MS;
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return unsent;
  const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => join(CLAUDE_PROJECTS_DIR, d.name));
  for (const projDir of projectDirs) {
    const projectName = basename(projDir);
    let files;
    try { files = readdirSync(projDir).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      if (sentSessions[sessionId]) continue;
      const filePath = join(projDir, file);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) continue;
        if (Date.now() - stat.mtimeMs < 60_000) continue;
        unsent.push({ sessionId, filePath, projectName });
      } catch { continue; }
    }
  }
  return unsent;
}

export async function runCatchup(configOverride) {
  const config = configOverride || loadConfig();
  if (!config) return { success: false, total: 0 };
  const sent = loadSentSessions();
  const unsent = findUnsentTranscripts(sent);
  if (unsent.length === 0) return { success: true, total: 0 };
  let successCount = 0;
  for (const { sessionId, filePath, projectName } of unsent) {
    try {
      const entries = parseJsonlFile(filePath);
      if (entries.length === 0) { sent[sessionId] = 'empty'; continue; }
      const records = aggregateByModel(entries);
      records.forEach(r => { r.projectName = projectName; });
      const report = {
        memberName: config.memberName, sessionId, records,
        reportedAt: new Date().toISOString(),
      };
      await sendReport(config.serverUrl, report, config.apiKey);
      sent[sessionId] = new Date().toISOString();
      successCount++;
    } catch (err) {
      console.error('ccusage-worv: catch-up 전송 실패 (' + sessionId + '):', err.message);
    }
  }
  saveSentSessions(sent);
  return { success: true, total: successCount };
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\\\/g, '/'));
if (isDirectRun) {
  const { total } = await runCatchup();
  if (total > 0) console.error('ccusage-worv: ' + total + '개 미전송 세션 catch-up 완료');
}
CATCHUPMJS

# --- scripts/collect.mjs ---
cat > "\$PLUGIN_DIR/scripts/collect.mjs" << 'COLLECTMJS'
#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import {
  loadConfig, loadSentSessions, saveSentSessions,
  parseJsonlFile, aggregateByModel, sendReport,
} from './lib/common.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 1000);
  });
}

async function main() {
  const config = loadConfig();
  if (!config) { process.exit(0); }
  let sessionId = 'unknown';
  let transcriptPath = '';
  try {
    const raw = await readStdin();
    if (raw.trim()) {
      const input = JSON.parse(raw);
      sessionId = input.session_id;
      transcriptPath = input.transcript_path;
    }
  } catch {}
  if (!transcriptPath || !existsSync(transcriptPath)) return;
  const entries = parseJsonlFile(transcriptPath);
  if (entries.length === 0) return;
  const records = aggregateByModel(entries);
  const projectName = basename(dirname(dirname(transcriptPath)));
  records.forEach(r => { r.projectName = projectName; });
  const report = {
    memberName: config.memberName, sessionId, records,
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
COLLECTMJS

# --- scripts/init.mjs ---
cat > "\$PLUGIN_DIR/scripts/init.mjs" << 'INITMJS'
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { CONFIG_PATH } from './lib/common.mjs';
import { runCatchup } from './catchup.mjs';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const PLUGIN_KEY = 'ccusage-worv@worv';

const memberName = process.argv[2];
const serverUrl = process.argv[3] || 'https://ccusage-worv.vercel.app';

if (!memberName) {
  console.error('사용법: node init.mjs <이름> [서버URL]');
  process.exit(1);
}

const config = {
  memberName: memberName.trim(),
  serverUrl: serverUrl.trim(),
};

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log('✓ 설정 저장 완료: ' + CONFIG_PATH);
console.log('  이름: ' + config.memberName);
console.log('  서버: ' + config.serverUrl);

try {
  let settings = {};
  if (existsSync(SETTINGS_PATH)) {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  } else {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  }
  if (!settings.enabledPlugins) settings.enabledPlugins = {};
  if (settings.enabledPlugins[PLUGIN_KEY] === true) {
    console.log('✓ 플러그인 이미 활성화됨: ' + PLUGIN_KEY);
  } else {
    settings.enabledPlugins[PLUGIN_KEY] = true;
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\\n');
    console.log('✓ 플러그인 활성화 완료: ' + PLUGIN_KEY);
  }
} catch (err) {
  console.error('⚠ 플러그인 자동 활성화 실패: ' + err.message);
}

console.log('');
console.log('과거 7일 미전송 세션 backfill 시작...');
try {
  const result = await runCatchup(config);
  if (result.total > 0) {
    console.log('✓ backfill 완료: ' + result.total + '개 세션 전송');
  } else {
    console.log('✓ backfill 완료: 미전송 세션 없음');
  }
} catch (err) {
  console.error('⚠ backfill 실패: ' + err.message);
}
INITMJS

echo "✓ 플러그인 파일 설치 완료: \$PLUGIN_DIR"

# --- installed_plugins.json 업데이트 ---
INSTALLED_FILE="\$HOME/.claude/plugins/installed_plugins.json"
node -e "
const fs = require('fs');
const path = '\$INSTALLED_FILE';
let data = { version: 2, plugins: {} };
try { data = JSON.parse(fs.readFileSync(path, 'utf-8')); } catch {}
if (!data.plugins) data.plugins = {};
data.plugins['ccusage-worv@worv'] = [{
  scope: 'user',
  installPath: '\$PLUGIN_DIR',
  version: '0.1.0',
  installedAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
}];
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('✓ installed_plugins.json 업데이트 완료');
"

# --- init 실행 (설정 저장 + 플러그인 활성화 + backfill) ---
echo ""
node "\$PLUGIN_DIR/scripts/init.mjs" "\$NAME"

echo ""
echo "=========================================="
echo "설치 완료! Claude Code를 재시작하세요."
echo "=========================================="
`;
}
