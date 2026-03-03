#!/usr/bin/env node

/**
 * ccusage-worv 설치 스크립트
 *
 * 사용법: npx ccusage-worv "이름"
 *
 * 1. plugin/ 디렉토리를 ~/.claude/plugins/cache/ 에 복사
 * 2. installed_plugins.json 등록
 * 3. init.mjs 실행 (설정 저장 + 플러그인 활성화 + backfill)
 */

import { cpSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');
const PLUGIN_SOURCE = join(PACKAGE_ROOT, 'plugin');

const VERSION = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8')).version;
const PLUGIN_DIR = join(homedir(), '.claude', 'plugins', 'cache', 'worv', 'ccusage-worv', VERSION);
const INSTALLED_PATH = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
const PLUGIN_KEY = 'ccusage-worv@worv';

const memberName = process.argv[2];

if (!memberName || memberName === '--help' || memberName === '-h') {
  console.log('');
  console.log('ccusage-worv - Claude Code 팀 사용량 수집 플러그인');
  console.log('');
  console.log('사용법:');
  console.log('  npx ccusage-worv "이름"');
  console.log('');
  console.log('예시:');
  console.log('  npx ccusage-worv "홍길동"');
  console.log('');
  process.exit(memberName ? 0 : 1);
}

console.log('');
console.log('ccusage-worv 설치 시작...');
console.log('');

// --- Step 1: 플러그인 파일 복사 ---

mkdirSync(dirname(PLUGIN_DIR), { recursive: true });
cpSync(PLUGIN_SOURCE, PLUGIN_DIR, { recursive: true });
console.log(`✓ 플러그인 파일 설치: ${PLUGIN_DIR}`);

// --- Step 2: installed_plugins.json 등록 ---

const pluginsDir = join(homedir(), '.claude', 'plugins');
mkdirSync(pluginsDir, { recursive: true });

let installed = { version: 2, plugins: {} };
if (existsSync(INSTALLED_PATH)) {
  try { installed = JSON.parse(readFileSync(INSTALLED_PATH, 'utf-8')); } catch {}
}
if (!installed.plugins) installed.plugins = {};

installed.plugins[PLUGIN_KEY] = [{
  scope: 'user',
  installPath: PLUGIN_DIR,
  version: VERSION,
  installedAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
}];

writeFileSync(INSTALLED_PATH, JSON.stringify(installed, null, 2));
console.log('✓ installed_plugins.json 등록 완료');

// --- Step 3: init 실행 (설정 저장 + 플러그인 활성화 + backfill) ---

console.log('');

try {
  execFileSync('node', [join(PLUGIN_DIR, 'scripts', 'init.mjs'), memberName], {
    stdio: 'inherit',
  });
} catch (err) {
  console.error('⚠ init 실행 중 오류:', err.message);
  process.exit(1);
}

console.log('');
console.log('==========================================');
console.log('설치 완료! Claude Code를 재시작하세요.');
console.log('==========================================');
