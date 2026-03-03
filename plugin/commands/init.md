---
name: init
description: ccusage-worv 초기 설정 (팀원 이름, 플러그인 활성화, 과거 데이터 backfill)
---

ccusage-worv 플러그인 초기 설정을 진행합니다.

사용자에게 **팀원 이름**(대시보드에 표시될 이름, 예: 홍길동)만 물어보세요.

정보를 받으면 아래 명령어를 실행하세요:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<이름>"
```

실행하면 3단계가 자동으로 수행됩니다:

1. **설정 저장**: `~/.ccusage-worv.json`에 이름과 서버 URL 저장
2. **플러그인 활성화**: `~/.claude/settings.json`의 `enabledPlugins`에 등록 (hook이 자동 실행되도록)
3. **과거 데이터 backfill**: 최근 7일 이내의 미전송 세션을 서버에 전송

설정이 완료되면 Claude Code 세션 시작/종료 시 자동으로 사용량이 서버에 전송됩니다.
