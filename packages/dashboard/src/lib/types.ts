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
  createdAt?: string;
}

// Dashboard에서 사용하는 팀원 (간략)
export interface TeamMemberSummary {
  id: string;
  name: string;
}

// 예산 관련 타입
export interface MemberBudgetUsage {
  memberId: string;
  memberName: string;
  budgetUsd: number;
  usedUsd: number;
  usagePercent: number;
}

export interface UsageVelocity {
  memberId: string;
  memberName: string;
  dailyAvgUsd: number;
  activeDays: number;
}

export interface BudgetConfig {
  id: string;
  memberId: string | null;
  budgetType: 'weekly' | 'monthly';
  budgetUsd: number;
}
