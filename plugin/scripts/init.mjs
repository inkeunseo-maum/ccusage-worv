#!/usr/bin/env node

/**
 * ccusage-worv 초기 설정 스크립트
 *
 * 사용법: node init.mjs <memberName> <serverUrl>
 *
 * 3단계 수행:
 * 1. ~/.ccusage-worv.json에 설정 저장
 * 2. ~/.claude/settings.json의 enabledPlugins에 플러그인 등록
 * 3. 과거 7일 미전송 세션 backfill
 */

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

// --- Step 1: 설정 저장 ---

const config = {
  memberName: memberName.trim(),
  serverUrl: serverUrl.trim(),
};

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log(`✓ 설정 저장 완료: ${CONFIG_PATH}`);
console.log(`  이름: ${config.memberName}`);
console.log(`  서버: ${config.serverUrl}`);

// --- Step 2: 플러그인 활성화 ---

try {
  let settings = {};

  if (existsSync(SETTINGS_PATH)) {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
  } else {
    mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  }

  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }

  if (settings.enabledPlugins[PLUGIN_KEY] === true) {
    console.log(`✓ 플러그인 이미 활성화됨: ${PLUGIN_KEY}`);
  } else {
    settings.enabledPlugins[PLUGIN_KEY] = true;
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
    console.log(`✓ 플러그인 활성화 완료: ${PLUGIN_KEY}`);
  }
} catch (err) {
  console.error(`⚠ 플러그인 자동 활성화 실패: ${err.message}`);
  console.error(`  수동으로 ~/.claude/settings.json에 다음을 추가하세요:`);
  console.error(`  "enabledPlugins": { "${PLUGIN_KEY}": true }`);
}

// --- Step 3: 과거 7일 backfill ---

console.log('');
console.log('과거 7일 미전송 세션 backfill 시작...');

try {
  const result = await runCatchup(config);
  if (result.total > 0) {
    console.log(`✓ backfill 완료: ${result.total}개 세션 전송`);
  } else {
    console.log(`✓ backfill 완료: 미전송 세션 없음`);
  }
} catch (err) {
  console.error(`⚠ backfill 실패 (설정과 플러그인 활성화는 정상 완료): ${err.message}`);
}
