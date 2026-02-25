# ccusage-worv Design Document

**Date**: 2026-02-25
**Project**: ccusage-worv — Claude Code 팀 사용량 수집 및 대시보드

## 목적

팀원(5~20명)의 Claude Code 토큰 사용량을 중앙에서 집계하고, 웹 대시보드로 시각화하는 도구.

## 요구사항

- **크로스 플랫폼**: macOS, Windows, Ubuntu Linux
- **데이터 수집**: Claude Code Hook으로 세션 종료 시 자동 전송
- **백엔드**: Supabase (개발 시 SQLite 대체)
- **대시보드**: Next.js 웹 UI
- **팀원 식별**: 초기 설정 시 이름 입력

## 아키텍처

### 프로젝트 구조 (pnpm monorepo)

```
ccusage-worv/
├── packages/
│   ├── collector/        ← Claude Code Hook용 경량 스크립트
│   │   ├── src/
│   │   │   ├── index.ts          ← 엔트리포인트
│   │   │   ├── config.ts         ← 설정 관리 (~/.ccusage-worv.json)
│   │   │   ├── parser.ts         ← JSONL 파싱
│   │   │   ├── sender.ts         ← 데이터 전송 (추상화 레이어)
│   │   │   ├── paths.ts          ← OS별 Claude 경로 감지
│   │   │   └── hooks.ts          ← Claude Code Hook 등록/해제
│   │   └── package.json
│   ├── dashboard/        ← Next.js 웹 대시보드
│   │   ├── src/
│   │   │   ├── app/              ← App Router
│   │   │   ├── components/       ← UI 컴포넌트
│   │   │   └── lib/              ← DB 클라이언트, 유틸
│   │   └── package.json
│   └── shared/           ← 공통 타입, 스키마
│       ├── src/
│       │   ├── types.ts          ← 공통 타입 정의
│       │   └── schema.ts         ← DB 스키마 정의
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

### 데이터 흐름

```
[팀원 PC]                        [서버]
Claude Code 세션 종료
    ↓
Hook 트리거 (Stop event)
    ↓
collector: JSONL 파싱
    ↓
collector: HTTP POST ──────────→ Dashboard API Route
                                     ↓
                                 SQLite 저장 (→ 추후 Supabase)
                                     ↓
                                 웹 대시보드 표시
```

### Collector 동작

1. **초기 설정**: `npx ccusage-worv init`
   - 팀원 이름 입력
   - 서버 URL 입력
   - `~/.ccusage-worv.json` 생성
   - Claude Code settings.json에 Hook 자동 등록

2. **Hook 트리거**: Claude Code 세션 종료 시
   - 현재 세션의 JSONL 파일 파싱
   - 토큰/비용 집계
   - HTTP POST로 서버에 전송

3. **설정 파일** (`~/.ccusage-worv.json`):
   ```json
   {
     "memberName": "홍길동",
     "serverUrl": "http://localhost:3000",
     "apiKey": "optional-key-for-supabase-later"
   }
   ```

### OS별 Claude Code 데이터 경로

- **macOS**: `~/.claude/projects/`
- **Linux**: `~/.claude/projects/` 또는 `$XDG_CONFIG_HOME/claude/projects/`
- **Windows**: `%APPDATA%/claude/projects/` 또는 `%USERPROFILE%/.claude/projects/`

### DB 스키마

**team_members**
- id: TEXT (UUID)
- name: TEXT
- created_at: TEXT (ISO 8601)

**usage_records**
- id: TEXT (UUID)
- member_id: TEXT (FK → team_members.id)
- session_id: TEXT
- model: TEXT
- input_tokens: INTEGER
- output_tokens: INTEGER
- cache_creation_tokens: INTEGER
- cache_read_tokens: INTEGER
- cost_usd: REAL
- project_name: TEXT
- recorded_at: TEXT (ISO 8601)
- created_at: TEXT (ISO 8601)

### 대시보드 페이지

- **/ (메인)**: 팀 전체 일별 사용량 차트 + 요약 카드
- **/members**: 팀원별 사용량 비교
- **/models**: 모델별 분포
- **/cost**: 비용 추이

### 로컬 개발 ↔ Supabase 전환 전략

- DB 접근을 추상화 레이어(repository 패턴)로 감싸기
- `packages/shared/src/repository.ts`에 인터페이스 정의
- SQLite 구현체와 Supabase 구현체를 교체 가능하게 구성
- 환경변수 `DATABASE_PROVIDER=sqlite|supabase`로 전환

### 기술 스택

- **언어**: TypeScript
- **패키지 매니저**: pnpm (workspace)
- **Collector**: Node.js (최소 의존성)
- **Dashboard**: Next.js 15 (App Router)
- **차트**: Recharts
- **DB (개발)**: better-sqlite3
- **DB (프로덕션)**: Supabase (PostgreSQL)
- **스타일**: Tailwind CSS
