'use client';

import { useEffect, useState } from 'react';
import { StatsCards } from '@/components/StatsCards';
import { DailyChart } from '@/components/DailyChart';
import { MemberTable } from '@/components/MemberTable';
import { ModelPieChart } from '@/components/ModelPieChart';

interface Stats {
  daily: { date: string; memberName: string; model: string; costUsd: number; inputTokens: number; outputTokens: number }[];
  members: { memberName: string; totalCost: number; totalTokens: number }[];
  models: { model: string; count: number; totalCost: number }[];
  teamMembers: { id: string; name: string }[];
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/stats?days=${days}`)
      .then(r => r.json())
      .then(setStats);
  }, [days]);

  if (!stats) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  const memberNames = [...new Set(stats.daily.map(d => d.memberName))];
  const dailyMap = new Map<string, Record<string, number>>();
  for (const d of stats.daily) {
    if (!dailyMap.has(d.date)) dailyMap.set(d.date, {});
    const row = dailyMap.get(d.date)!;
    row[d.memberName] = (row[d.memberName] || 0) + d.costUsd;
  }
  const dailyChartData = Array.from(dailyMap.entries())
    .map(([date, row]) => ({ date, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalCost = stats.members.reduce((s, m) => s + m.totalCost, 0);
  const totalTokens = stats.members.reduce((s, m) => s + m.totalTokens, 0);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold dark:text-white">ccusage-worv Dashboard</h1>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border px-3 py-1 bg-white dark:bg-gray-800 dark:text-white"
          >
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
            <option value={90}>최근 90일</option>
          </select>
        </div>

        <StatsCards
          totalCost={totalCost}
          totalTokens={totalTokens}
          memberCount={stats.teamMembers.length}
          sessionCount={stats.daily.length}
        />

        <DailyChart data={dailyChartData} members={memberNames} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MemberTable data={stats.members} />
          <ModelPieChart data={stats.models} />
        </div>
      </div>
    </main>
  );
}
