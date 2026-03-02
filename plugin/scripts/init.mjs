#!/usr/bin/env node

/**
 * ccusage-worv 초기 설정 스크립트
 *
 * 사용법: node init.mjs <memberName> <serverUrl>
 * ~/.ccusage-worv.json에 설정을 저장합니다.
 */

import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_PATH = join(homedir(), '.ccusage-worv.json');

const memberName = process.argv[2];
const serverUrl = process.argv[3] || 'http://localhost:3000';

if (!memberName) {
  console.error('사용법: node init.mjs <이름> [서버URL]');
  process.exit(1);
}

const config = {
  memberName: memberName.trim(),
  serverUrl: serverUrl.trim(),
};

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log(`설정 저장 완료: ${CONFIG_PATH}`);
console.log(`  이름: ${config.memberName}`);
console.log(`  서버: ${config.serverUrl}`);
