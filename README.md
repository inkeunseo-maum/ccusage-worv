# ccusage-worv

Claude Code 팀 사용량을 중앙에서 수집하고 웹 대시보드로 시각화하는 Claude Code 플러그인.

## 프로젝트 구조

```
ccusage-worv/
├── plugin/                     ← Claude Code 플러그인
│   ├── hooks/hooks.json        ← SessionEnd hook 등록
│   ├── scripts/collect.mjs     ← JSONL 파싱 + 서버 전송
│   ├── scripts/init.mjs        ← 팀원 초기 설정
│   └── commands/init.md        ← /ccusage-worv:init 슬래시 커맨드
├── packages/
│   └── dashboard/              ← Next.js 웹 대시보드
│       ├── src/app/api/        ← API Routes (usage, stats)
│       ├── src/components/     ← 차트 및 UI 컴포넌트
│       └── src/lib/            ← DB, 스키마, repository
├── scripts/seed.ts             ← 테스트 데이터 생성
└── pnpm-workspace.yaml
```

## 데이터 흐름

```
[팀원 PC]                              [대시보드 서버]
Claude Code 세션 종료
    ↓
SessionEnd hook 트리거
    ↓
collect.mjs: JSONL 트랜스크립트 파싱
    ↓
모델별 토큰 집계 + 비용 계산
    ↓
HTTP POST /api/usage ──────────────→ 요청 수신
                                         ↓
                                     SQLite에 저장
                                         ↓
                                     웹 대시보드에 표시
```

## 팀원 설치 (Claude Code 플러그인)

### 1. 플러그인 설치

```bash
# 마켓플레이스에서 설치
/plugin marketplace add inkeunseo-maum/ccusage-worv
/plugin install ccusage-worv@worv
```

### 2. 초기 설정

Claude Code에서 슬래시 커맨드 실행:

```
/ccusage-worv:init
```

팀원 이름과 서버 URL을 입력하면 `~/.ccusage-worv.json`에 설정이 저장됩니다.

이후 Claude Code 세션 종료 시마다 사용량이 자동으로 서버에 전송됩니다.

### 설정 파일

`~/.ccusage-worv.json`:

```json
{
  "memberName": "홍길동",
  "serverUrl": "https://ccusage-worv.vercel.app"
}
```

### 로컬 테스트 (개발용)

```bash
claude --plugin-dir ./plugin
```

## 대시보드 서버 운영

### 실행

```bash
git clone https://github.com/inkeunseo-maum/ccusage-worv.git
cd ccusage-worv
pnpm install
pnpm dev
```

http://localhost:3000 에서 대시보드를 확인할 수 있습니다.

### 환경변수

- `DATABASE_PATH` — SQLite DB 파일 경로 (기본값: `packages/dashboard/data.db`)

### 테스트 데이터 넣기

```bash
pnpm seed
```

## 대시보드 기능

- **요약 카드** — 총 비용, 총 토큰, 팀원 수, 세션 수
- **일별 비용 차트** — 팀원별 스택 바 차트 (Recharts)
- **팀원별 사용량** — 비용 기준 랭킹 + 프로그레스 바
- **모델 분포** — 도넛 차트로 모델별 비용 비율
- **기간 필터** — 7일 / 30일 / 90일 전환

## 비용 계산

플러그인이 모델별 토큰 가격을 기반으로 비용을 추정합니다 (USD per 1M tokens):

- **claude-opus-4-6** — input: $15, output: $75, cache read: $1.5, cache write: $18.75
- **claude-sonnet-4-6** — input: $3, output: $15, cache read: $0.3, cache write: $3.75
- **claude-haiku-4-5** — input: $0.8, output: $4, cache read: $0.08, cache write: $1

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

대시보드 통계를 조회합니다. `days` 파라미터로 조회 기간을 지정합니다 (기본값: 30).

**Response Body:**

```json
{
  "daily": [
    { "date": "2026-02-25", "memberName": "홍길동", "model": "claude-sonnet-4-6", "costUsd": 0.05, "inputTokens": 1000, "outputTokens": 500 }
  ],
  "members": [
    { "memberName": "홍길동", "totalCost": 1.23, "totalTokens": 50000 }
  ],
  "models": [
    { "model": "claude-sonnet-4-6", "count": 10, "totalCost": 0.50 }
  ],
  "teamMembers": [
    { "id": "uuid", "name": "홍길동" }
  ]
}
```

## 기술 스택

- **플러그인** — Node.js ESM, 외부 의존성 없음, SessionEnd hook
- **대시보드** — Next.js 16 (App Router), React 19, Recharts, Tailwind CSS 4
- **DB** — SQLite (better-sqlite3), WAL 모드
- **패키지 매니저** — pnpm (workspace)
- **Node.js** — >= 20

## 개발

```bash
# 의존성 설치
pnpm install

# 대시보드 개발 서버
pnpm dev

# 빌드
pnpm build

# 테스트 데이터 삽입
pnpm seed
```

## 라이선스

MIT
