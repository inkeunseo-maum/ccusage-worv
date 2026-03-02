---
name: init
description: ccusage-worv 초기 설정 (팀원 이름, 서버 URL)
---

ccusage-worv 플러그인 초기 설정을 진행합니다.

사용자에게 다음 정보를 물어보세요:

1. **팀원 이름**: 대시보드에 표시될 이름 (예: 홍길동)
2. **서버 URL**: 대시보드 서버 주소 (기본값: http://localhost:3000)

정보를 받으면 아래 명령어를 실행하세요:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<이름>" "<서버URL>"
```

설정이 완료되면 Claude Code 세션 종료 시 자동으로 사용량이 서버에 전송됩니다.
