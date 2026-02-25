# ccusage-worv

Claude Code 팀 사용량을 중앙에서 수집하고 웹 대시보드로 시각화하는 도구.

## 구성

- **@ccusage-worv/shared** — 공통 타입 및 DB 스키마
- **@ccusage-worv/collector** — Claude Code Hook으로 사용량 수집/전송
- **@ccusage-worv/dashboard** — Next.js 웹 대시보드

## 빠른 시작

### 1. 대시보드 서버 실행

```bash
git clone <repo-url>
cd ccusage-worv
pnpm install
pnpm dev
```

http://localhost:3000 에서 대시보드를 확인할 수 있습니다.

### 2. 테스트 데이터 넣기

```bash
pnpm seed
```

### 3. 팀원 PC에 Collector 설치

각 팀원의 PC에서 실행:

```bash
npx @ccusage-worv/collector init
```

- 팀원 이름 입력
- 서버 URL 입력 (예: http://dashboard-server:3000)
- Claude Code SessionEnd hook이 자동 등록됩니다

이후 Claude Code 세션 종료 시마다 사용량이 자동으로 서버에 전송됩니다.

## 지원 플랫폼

- macOS
- Windows
- Ubuntu Linux

## 기술 스택

- **언어**: TypeScript
- **패키지 매니저**: pnpm (workspace)
- **Collector**: Node.js
- **Dashboard**: Next.js 15 (App Router)
- **차트**: Recharts
- **DB (개발)**: SQLite (better-sqlite3)
- **DB (프로덕션)**: Supabase (예정)
- **스타일**: Tailwind CSS

## 개발

```bash
# 의존성 설치
pnpm install

# 대시보드 개발 서버
pnpm dev

# 테스트
pnpm test

# 빌드
pnpm build
```

## API

### POST /api/usage

사용량 데이터를 수신합니다.

**Request Body:**

```json
{
  "memberName": "홍길동",
  "sessionId": "session-123",
  "records": [
    {
      "model": "claude-sonnet-4-6",
      "inputTokens": 1000,
      "outputTokens": 500,
      "cacheCreationTokens": 200,
      "cacheReadTokens": 100,
      "costUsd": 0.05,
      "projectName": "my-project",
      "recordedAt": "2026-02-25T10:00:00Z"
    }
  ],
  "reportedAt": "2026-02-25T10:30:00Z"
}
```

### GET /api/stats?days=30

대시보드 통계를 조회합니다.

## 라이선스

MIT
