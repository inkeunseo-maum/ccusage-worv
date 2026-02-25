'use client';

interface MemberData {
  memberName: string;
  totalCost: number;
  totalTokens: number;
}

interface Props {
  data: MemberData[];
}

export function MemberTable({ data }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">팀원별 사용량</h2>
      <div className="space-y-2">
        {data.map((m) => (
          <div key={m.memberName} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-medium">{m.memberName}</span>
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              <span>{formatTokens(m.totalTokens)} tokens</span>
              <span className="font-semibold text-gray-900 dark:text-white">${m.totalCost.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
