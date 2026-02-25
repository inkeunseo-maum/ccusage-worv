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
  reportedAt: string;
}

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  projectName: string;
  recordedAt: string;
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
