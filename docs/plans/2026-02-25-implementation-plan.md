# ccusage-worv Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Claude Code 팀 사용량을 SessionEnd hook으로 수집하여 Supabase(개발 시 SQLite)에 저장하고, Next.js 웹 대시보드로 시각화한다.

**Architecture:** pnpm monorepo 3개 패키지 (shared → collector → dashboard). Collector는 Claude Code SessionEnd hook으로 JSONL 파싱 후 HTTP POST 전송. Dashboard는 Next.js App Router + better-sqlite3 + Recharts. DB 접근은 repository 패턴으로 추상화하여 SQLite↔Supabase 교체 가능.

**Tech Stack:** TypeScript, pnpm workspace, Node.js, Next.js 15, better-sqlite3, Recharts, Tailwind CSS

---

## Task 1: Monorepo 스캐폴딩

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.npmrc`

**Step 1: Git 초기화 및 루트 package.json 생성**

```bash
cd ~/projects/ccusage-worv
git init
```

```json
// package.json
{
  "name": "ccusage-worv",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter dashboard dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "engines": {
    "node": ">=20"
  }
}
```

**Step 2: pnpm workspace 설정**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

**Step 3: 공통 tsconfig 생성**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

**Step 4: .gitignore 생성**

```
node_modules/
dist/
.next/
*.db
.env
.env.local
```

**Step 5: 커밋**

```bash
git add package.json pnpm-workspace.yaml tsconfig.json .gitignore .npmrc
git commit -m "chore: init monorepo scaffold"
```

---

## Task 2: shared 패키지 — 타입 및 스키마

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schema.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: shared package.json**

```json
{
  "name": "@ccusage-worv/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "echo 'no tests yet'"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: 공통 타입 정의**

```typescript
// packages/shared/src/types.ts

// Claude Code JSONL 한 줄의 구조
export interface ClaudeUsageEntry {
  timestamp: string;
  sessionId: string;
  model: string;
  costUSD?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  version?: string;
}

// Collector → Server로 전송하는 데이터
export interface UsageReport {
  memberName: string;
  sessionId: string;
  records: UsageRecord[];
  reportedAt: string; // ISO 8601
}

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  projectName: string;
  recordedAt: string; // ISO 8601
}

// DB에 저장되는 팀원
export interface TeamMember {
  id: string;
  name: string;
  createdAt: string;
}

// DB에 저장되는 사용 기록
export interface DbUsageRecord {
  id: string;
  memberId: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  projectName: string;
  recordedAt: string;
  createdAt: string;
}

// Collector 설정 파일
export interface CollectorConfig {
  memberName: string;
  serverUrl: string;
  apiKey?: string;
}

// Hook에서 stdin으로 받는 SessionEnd 데이터
export interface SessionEndInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  reason: string;
}
```

**Step 3: DB 스키마 SQL 정의**

```typescript
// packages/shared/src/schema.ts

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  project_name TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES team_members(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_member ON usage_records(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded ON usage_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);
`;
```

**Step 4: index.ts 배럴 export**

```typescript
// packages/shared/src/index.ts
export * from './types.js';
export * from './schema.js';
```

**Step 5: 커밋**

```bash
git add packages/shared/
git commit -m "feat: add shared types and schema"
```

---

## Task 3: collector 패키지 — JSONL 파서

**Files:**
- Create: `packages/collector/package.json`
- Create: `packages/collector/tsconfig.json`
- Create: `packages/collector/src/paths.ts`
- Create: `packages/collector/src/parser.ts`
- Create: `packages/collector/src/__tests__/parser.test.ts`

**Step 1: collector package.json**

```json
{
  "name": "@ccusage-worv/collector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "ccusage-worv": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsx src/cli.ts"
  },
  "dependencies": {
    "@ccusage-worv/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsx": "^4.0.0"
  }
}
```

**Step 2: OS별 경로 감지**

```typescript
// packages/collector/src/paths.ts
import { homedir } from 'node:os';
import { join } from 'node:path';

export function getClaudeProjectsDir(): string {
  const home = homedir();
  const platform = process.platform;

  if (platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) return join(appdata, 'claude', 'projects');
    return join(home, '.claude', 'projects');
  }

  // macOS and Linux
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, 'claude', 'projects');
  }
  return join(home, '.claude', 'projects');
}

export function getConfigPath(): string {
  return join(homedir(), '.ccusage-worv.json');
}

export function getClaudeSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}
```

**Step 3: JSONL 파서 테스트 작성**

```typescript
// packages/collector/src/__tests__/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseJsonlFile, aggregateByModel } from '../parser.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'ccusage-worv-test');

describe('parseJsonlFile', () => {
  it('parses valid JSONL lines with usage data', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, 'test.jsonl');
    const lines = [
      JSON.stringify({
        timestamp: '2026-02-25T10:00:00Z',
        sessionId: 'sess-1',
        model: 'claude-sonnet-4-6',
        costUSD: 0.05,
        usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 200, cacheReadInputTokens: 100 }
      }),
      JSON.stringify({
        timestamp: '2026-02-25T10:05:00Z',
        sessionId: 'sess-1',
        model: 'claude-sonnet-4-6',
        costUSD: 0.03,
        usage: { inputTokens: 800, outputTokens: 300 }
      })
    ];
    writeFileSync(file, lines.join('\n'));

    const entries = parseJsonlFile(file);
    expect(entries).toHaveLength(2);
    expect(entries[0].model).toBe('claude-sonnet-4-6');
    expect(entries[0].usage?.inputTokens).toBe(1000);
    expect(entries[1].usage?.outputTokens).toBe(300);

    rmSync(TEST_DIR, { recursive: true });
  });

  it('skips malformed lines', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, 'bad.jsonl');
    writeFileSync(file, 'not-json\n{"timestamp":"2026-02-25T10:00:00Z","sessionId":"s1","model":"claude-sonnet-4-6","usage":{"inputTokens":1,"outputTokens":1}}\n');

    const entries = parseJsonlFile(file);
    expect(entries).toHaveLength(1);

    rmSync(TEST_DIR, { recursive: true });
  });
});

describe('aggregateByModel', () => {
  it('sums tokens by model', () => {
    const entries = [
      { timestamp: 't1', sessionId: 's', model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50 } },
      { timestamp: 't2', sessionId: 's', model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100 } },
      { timestamp: 't3', sessionId: 's', model: 'claude-opus-4-6', usage: { inputTokens: 500, outputTokens: 250 } },
    ];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(2);

    const sonnet = result.find(r => r.model === 'claude-sonnet-4-6');
    expect(sonnet?.inputTokens).toBe(300);
    expect(sonnet?.outputTokens).toBe(150);
  });
});
```

**Step 4: JSONL 파서 구현**

```typescript
// packages/collector/src/parser.ts
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
```

**Step 5: 테스트 실행**

```bash
cd ~/projects/ccusage-worv && pnpm install && pnpm --filter @ccusage-worv/collector test
```

**Step 6: 커밋**

```bash
git add packages/collector/
git commit -m "feat: add JSONL parser with tests"
```

---

## Task 4: collector — 설정 관리 및 init CLI

**Files:**
- Create: `packages/collector/src/config.ts`
- Create: `packages/collector/src/hooks.ts`
- Create: `packages/collector/src/cli.ts`

**Step 1: 설정 관리**

```typescript
// packages/collector/src/config.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getConfigPath } from './paths.js';
import type { CollectorConfig } from '@ccusage-worv/shared';

export function loadConfig(): CollectorConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveConfig(config: CollectorConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}
```

**Step 2: Hook 등록/해제**

```typescript
// packages/collector/src/hooks.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getClaudeSettingsPath } from './paths.js';

const HOOK_COMMAND = 'npx @ccusage-worv/collector collect';

export function registerHook(): void {
  const settingsPath = getClaudeSettingsPath();
  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  hooks['SessionEnd'] = [
    {
      hooks: [
        {
          type: 'command',
          command: HOOK_COMMAND,
          timeout: 30,
        },
      ],
    },
  ];

  settings.hooks = hooks;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function unregisterHook(): void {
  const settingsPath = getClaudeSettingsPath();
  if (!existsSync(settingsPath)) return;

  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  if (settings.hooks?.SessionEnd) {
    delete settings.hooks.SessionEnd;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
}
```

**Step 3: CLI 엔트리포인트 (init + collect)**

```typescript
// packages/collector/src/cli.ts
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { loadConfig, saveConfig } from './config.js';
import { registerHook } from './hooks.js';
import { collect } from './index.js';

async function init() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('=== ccusage-worv 초기 설정 ===\n');

  const memberName = await rl.question('팀원 이름을 입력하세요: ');
  const serverUrl = await rl.question('서버 URL을 입력하세요 (기본: http://localhost:3000): ');

  saveConfig({
    memberName: memberName.trim(),
    serverUrl: (serverUrl.trim() || 'http://localhost:3000'),
  });

  registerHook();

  console.log('\n✓ 설정 저장 완료');
  console.log('✓ Claude Code SessionEnd hook 등록 완료');
  console.log('\nClaude Code 세션 종료 시 자동으로 사용량이 전송됩니다.');

  rl.close();
}

const command = argv[2];

if (command === 'init') {
  init().catch(console.error);
} else if (command === 'collect') {
  collect().catch(console.error);
} else {
  console.log('Usage: ccusage-worv <init|collect>');
}
```

**Step 4: 커밋**

```bash
git add packages/collector/src/
git commit -m "feat: add collector config, hooks, and CLI"
```

---

## Task 5: collector — collect 명령 (Hook 핸들러)

**Files:**
- Create: `packages/collector/src/sender.ts`
- Modify: `packages/collector/src/index.ts`

**Step 1: HTTP 전송 모듈**

```typescript
// packages/collector/src/sender.ts
import type { UsageReport } from '@ccusage-worv/shared';

export async function sendReport(serverUrl: string, report: UsageReport, apiKey?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
```

**Step 2: collect 메인 로직**

```typescript
// packages/collector/src/index.ts
import { loadConfig } from './config.js';
import { parseJsonlFile, aggregateByModel } from './parser.js';
import { sendReport } from './sender.js';
import { globSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import type { SessionEndInput, UsageReport } from '@ccusage-worv/shared';

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // stdin이 비어있을 수 있으므로 타임아웃 설정
    setTimeout(() => resolve(data), 1000);
  });
}

function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const parent = entry.parentPath ?? entry.path;
        files.push(resolve(parent, entry.name));
      }
    }
  } catch {
    // directory not found
  }
  return files;
}

export async function collect(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error('설정이 없습니다. ccusage-worv init을 먼저 실행하세요.');
    process.exit(1);
  }

  // stdin에서 SessionEnd 데이터 읽기
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

  // transcript_path가 있으면 해당 파일만, 없으면 최근 JSONL 파일 검색
  let files: string[] = [];
  if (transcriptPath) {
    files = [transcriptPath];
  }

  if (files.length === 0) {
    console.error('파싱할 JSONL 파일을 찾을 수 없습니다.');
    return;
  }

  // 모든 JSONL 파일 파싱 및 집계
  const allEntries = files.flatMap(f => parseJsonlFile(f));
  if (allEntries.length === 0) return;

  const records = aggregateByModel(allEntries);

  // 프로젝트명 추출 (transcript 경로에서)
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
```

**Step 3: 커밋**

```bash
git add packages/collector/src/
git commit -m "feat: add collect command with stdin parsing and HTTP sender"
```

---

## Task 6: dashboard — Next.js 스캐폴딩 + SQLite DB

**Files:**
- Create: `packages/dashboard/` (Next.js 프로젝트)
- Create: `packages/dashboard/src/lib/db.ts`
- Create: `packages/dashboard/src/lib/repository.ts`

**Step 1: Next.js 프로젝트 생성**

```bash
cd ~/projects/ccusage-worv/packages
pnpm create next-app dashboard --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-pnpm
```

**Step 2: better-sqlite3 설치 및 DB 초기화**

```bash
cd ~/projects/ccusage-worv
pnpm --filter dashboard add better-sqlite3
pnpm --filter dashboard add -D @types/better-sqlite3
pnpm --filter dashboard add @ccusage-worv/shared
```

```typescript
// packages/dashboard/src/lib/db.ts
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { CREATE_TABLES_SQL } from '@ccusage-worv/shared';

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_TABLES_SQL);
  }
  return db;
}
```

**Step 3: Repository 패턴 (SQLite 구현)**

```typescript
// packages/dashboard/src/lib/repository.ts
import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import type { UsageReport, TeamMember, DbUsageRecord } from '@ccusage-worv/shared';

export function getOrCreateMember(name: string): TeamMember {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM team_members WHERE name = ?').get(name) as TeamMember | undefined;
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
  return getDb().prepare('SELECT * FROM team_members ORDER BY name').all() as TeamMember[];
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
```

**Step 4: 커밋**

```bash
git add packages/dashboard/
git commit -m "feat: add dashboard with SQLite DB and repository"
```

---

## Task 7: dashboard — API Route (데이터 수신)

**Files:**
- Create: `packages/dashboard/src/app/api/usage/route.ts`
- Create: `packages/dashboard/src/app/api/stats/route.ts`

**Step 1: POST /api/usage — Collector에서 데이터 수신**

```typescript
// packages/dashboard/src/app/api/usage/route.ts
import { NextResponse } from 'next/server';
import { insertUsageReport } from '@/lib/repository';
import type { UsageReport } from '@ccusage-worv/shared';

export async function POST(request: Request) {
  try {
    const report: UsageReport = await request.json();

    if (!report.memberName || !report.records?.length) {
      return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
    }

    insertUsageReport(report);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save usage report:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: GET /api/stats — 대시보드 데이터 조회**

```typescript
// packages/dashboard/src/app/api/stats/route.ts
import { NextResponse } from 'next/server';
import { getDailyUsage, getMemberUsage, getModelDistribution, getAllMembers } from '@/lib/repository';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  const daily = getDailyUsage(days);
  const members = getMemberUsage(days);
  const models = getModelDistribution(days);
  const teamMembers = getAllMembers();

  return NextResponse.json({ daily, members, models, teamMembers });
}
```

**Step 3: 커밋**

```bash
git add packages/dashboard/src/app/api/
git commit -m "feat: add API routes for usage ingestion and stats"
```

---

## Task 8: dashboard — 메인 대시보드 UI

**Files:**
- Modify: `packages/dashboard/src/app/page.tsx`
- Create: `packages/dashboard/src/app/layout.tsx` (이미 존재하면 수정)
- Create: `packages/dashboard/src/components/DailyChart.tsx`
- Create: `packages/dashboard/src/components/MemberTable.tsx`
- Create: `packages/dashboard/src/components/ModelPieChart.tsx`
- Create: `packages/dashboard/src/components/StatsCards.tsx`

**Step 1: Recharts 설치**

```bash
pnpm --filter dashboard add recharts
```

**Step 2: StatsCards 요약 카드 컴포넌트**

```typescript
// packages/dashboard/src/components/StatsCards.tsx
'use client';

interface Props {
  totalCost: number;
  totalTokens: number;
  memberCount: number;
  sessionCount: number;
}

export function StatsCards({ totalCost, totalTokens, memberCount, sessionCount }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="총 비용" value={`$${totalCost.toFixed(2)}`} />
      <Card label="총 토큰" value={formatNumber(totalTokens)} />
      <Card label="팀원 수" value={String(memberCount)} />
      <Card label="세션 수" value={String(sessionCount)} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
```

**Step 3: DailyChart 일별 사용량 차트**

```typescript
// packages/dashboard/src/components/DailyChart.tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DailyData {
  date: string;
  costUsd: number;
  [memberName: string]: string | number;
}

interface Props {
  data: DailyData[];
  members: string[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function DailyChart({ data, members }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">일별 비용 추이</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
          <Legend />
          {members.map((name, i) => (
            <Bar key={name} dataKey={name} stackId="cost" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 4: MemberTable 팀원별 테이블**

```typescript
// packages/dashboard/src/components/MemberTable.tsx
'use client';

interface MemberData {
  memberName: string;
  totalCost: number;
  totalTokens: number;
}

interface Props {
  data: MemberData[];
}

export function MemberTable({ data }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">팀원별 사용량</h2>
      <div className="space-y-2">
        {data.map((m) => (
          <div key={m.memberName} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-medium">{m.memberName}</span>
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              <span>{formatTokens(m.totalTokens)} tokens</span>
              <span className="font-semibold text-gray-900 dark:text-white">${m.totalCost.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
```

**Step 5: ModelPieChart 모델 분포**

```typescript
// packages/dashboard/src/components/ModelPieChart.tsx
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ModelData {
  model: string;
  count: number;
  totalCost: number;
}

interface Props {
  data: ModelData[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export function ModelPieChart({ data }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">모델 분포</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="totalCost"
            nameKey="model"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ model, percent }) => `${model.replace('claude-', '')} (${(percent * 100).toFixed(0)}%)`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 6: 메인 페이지**

```typescript
// packages/dashboard/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { StatsCards } from '@/components/StatsCards';
import { DailyChart } from '@/components/DailyChart';
import { MemberTable } from '@/components/MemberTable';
import { ModelPieChart } from '@/components/ModelPieChart';

interface Stats {
  daily: { date: string; memberName: string; model: string; costUsd: number; inputTokens: number; outputTokens: number }[];
  members: { memberName: string; totalCost: number; totalTokens: number }[];
  models: { model: string; count: number; totalCost: number }[];
  teamMembers: { id: string; name: string }[];
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/stats?days=${days}`)
      .then(r => r.json())
      .then(setStats);
  }, [days]);

  if (!stats) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  // 일별 차트 데이터 변환: 날짜별 × 팀원별 비용
  const memberNames = [...new Set(stats.daily.map(d => d.memberName))];
  const dailyMap = new Map<string, Record<string, number>>();
  for (const d of stats.daily) {
    if (!dailyMap.has(d.date)) dailyMap.set(d.date, { date: 0 } as unknown as Record<string, number>);
    const row = dailyMap.get(d.date)!;
    row[d.memberName] = (row[d.memberName] || 0) + d.costUsd;
  }
  const dailyChartData = Array.from(dailyMap.entries())
    .map(([date, row]) => ({ date, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalCost = stats.members.reduce((s, m) => s + m.totalCost, 0);
  const totalTokens = stats.members.reduce((s, m) => s + m.totalTokens, 0);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ccusage-worv Dashboard</h1>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border px-3 py-1 bg-white dark:bg-gray-800"
          >
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
          </select>
        </div>

        <StatsCards
          totalCost={totalCost}
          totalTokens={totalTokens}
          memberCount={stats.teamMembers.length}
          sessionCount={stats.daily.length}
        />

        <DailyChart data={dailyChartData} members={memberNames} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MemberTable data={stats.members} />
          <ModelPieChart data={stats.models} />
        </div>
      </div>
    </main>
  );
}
```

**Step 7: 커밋**

```bash
git add packages/dashboard/src/
git commit -m "feat: add dashboard UI with charts and stats"
```

---

## Task 9: E2E 테스트 — 시드 데이터 및 검증

**Files:**
- Create: `scripts/seed.ts`
- Create: `scripts/test-collect.ts`

**Step 1: 시드 데이터 생성 스크립트**

```typescript
// scripts/seed.ts
// 대시보드에 테스트 데이터를 넣는 스크립트
const SERVER = process.argv[2] || 'http://localhost:3000';

const MEMBERS = ['김인근', '박지훈', '이서연', '최동현', '정수민'];
const MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'];

async function seed() {
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);

    for (const member of MEMBERS) {
      // 랜덤하게 일부 멤버만 해당 날짜에 활동
      if (Math.random() < 0.3) continue;

      const model = MODELS[Math.floor(Math.random() * MODELS.length)];
      const inputTokens = Math.floor(Math.random() * 50000) + 1000;
      const outputTokens = Math.floor(Math.random() * 20000) + 500;

      const costMap: Record<string, number> = {
        'claude-opus-4-6': (inputTokens * 15 + outputTokens * 75) / 1_000_000,
        'claude-sonnet-4-6': (inputTokens * 3 + outputTokens * 15) / 1_000_000,
        'claude-haiku-4-5': (inputTokens * 0.8 + outputTokens * 4) / 1_000_000,
      };

      const report = {
        memberName: member,
        sessionId: `seed-${member}-${dayOffset}-${Date.now()}`,
        records: [{
          model,
          inputTokens,
          outputTokens,
          cacheCreationTokens: Math.floor(inputTokens * 0.3),
          cacheReadTokens: Math.floor(inputTokens * 0.5),
          costUsd: costMap[model] || 0.01,
          projectName: ['worv-web', 'worv-api', 'worv-ml'][Math.floor(Math.random() * 3)],
          recordedAt: date.toISOString(),
        }],
        reportedAt: new Date().toISOString(),
      };

      const res = await fetch(`${SERVER}/api/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!res.ok) console.error(`Failed for ${member}: ${res.status}`);
    }
  }
  console.log('✓ Seed data inserted');
}

seed().catch(console.error);
```

**Step 2: 커밋**

```bash
git add scripts/
git commit -m "feat: add seed script for test data"
```

---

## Task 10: 최종 통합 및 README

**Files:**
- Create: `README.md`
- Modify: `package.json` (scripts 추가)

**Step 1: README 작성**

팀원용 설치 가이드, 대시보드 실행법, 개발 가이드를 포함한 README.

**Step 2: package.json에 seed 스크립트 추가**

```json
{
  "scripts": {
    "dev": "pnpm --filter dashboard dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "seed": "tsx scripts/seed.ts"
  }
}
```

**Step 3: 전체 테스트**

```bash
pnpm install
pnpm --filter @ccusage-worv/collector test
pnpm dev &
sleep 3
pnpm seed
# 브라우저에서 http://localhost:3000 확인
```

**Step 4: 커밋**

```bash
git add .
git commit -m "docs: add README and finalize project"
```

---

## 요약

- Task 1: Monorepo 스캐폴딩
- Task 2: shared 패키지 (타입, 스키마)
- Task 3: collector — JSONL 파서 + 테스트
- Task 4: collector — 설정/Hook/CLI
- Task 5: collector — collect 명령
- Task 6: dashboard — Next.js + SQLite
- Task 7: dashboard — API Routes
- Task 8: dashboard — UI 컴포넌트
- Task 9: 시드 데이터 + E2E 검증
- Task 10: README + 최종 통합
