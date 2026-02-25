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
    serverUrl: serverUrl.trim() || 'http://localhost:3000',
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
