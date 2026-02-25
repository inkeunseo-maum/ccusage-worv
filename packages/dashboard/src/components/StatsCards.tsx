'use client';

interface Props {
  totalCost: number;
  totalTokens: number;
  memberCount: number;
  sessionCount: number;
}

export function StatsCards({ totalCost, totalTokens, memberCount, sessionCount }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="총 비용" value={`$${totalCost.toFixed(2)}`} />
      <Card label="총 토큰" value={formatNumber(totalTokens)} />
      <Card label="팀원 수" value={String(memberCount)} />
      <Card label="세션 수" value={String(sessionCount)} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
