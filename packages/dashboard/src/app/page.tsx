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

const PERIOD_OPTIONS = [
  { label: '7일', value: 7 },
  { label: '30일', value: 30 },
  { label: '90일', value: 90 },
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/stats?days=${days}`)
      .then(r => r.json())
      .then(setStats);
  }, [days]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#09090b' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p style={{ color: '#71717a', fontSize: '13px', letterSpacing: '0.05em' }}>LOADING</p>
        </div>
      </div>
    );
  }

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
    <main className="min-h-screen" style={{ background: '#09090b' }}>
      {/* Ambient gradient backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <header
          className="animate-fade-in"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(9,9,11,0.8)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            className="max-w-6xl mx-auto flex items-center justify-between"
            style={{ padding: '14px 24px' }}
          >
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                }}
              >
                ◆
              </div>
              <div>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#fafafa',
                    letterSpacing: '-0.01em',
                  }}
                >
                  ccusage
                </span>
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: '14px',
                    color: '#52525b',
                    marginLeft: '1px',
                  }}
                >
                  -worv
                </span>
              </div>
              <div
                style={{
                  height: '16px',
                  width: '1px',
                  background: 'rgba(255,255,255,0.08)',
                  margin: '0 4px',
                }}
              />
              <span style={{ fontSize: '13px', color: '#71717a' }}>Team Usage</span>
            </div>

            {/* Period pills */}
            <div className="flex items-center gap-1" style={{ padding: '3px', borderRadius: '9999px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`period-pill${days === opt.value ? ' active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="max-w-6xl mx-auto" style={{ padding: '32px 24px 48px' }}>
          {/* Page title */}
          <div className="animate-fade-in-up animate-delay-1" style={{ marginBottom: '28px' }}>
            <h1
              className="gradient-text"
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: '4px',
              }}
            >
              Team Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#52525b' }}>
              최근 {days}일간의 Claude API 사용 현황
            </p>
          </div>

          {/* Stats cards */}
          <div className="animate-fade-in-up animate-delay-2" style={{ marginBottom: '24px' }}>
            <StatsCards
              totalCost={totalCost}
              totalTokens={totalTokens}
              memberCount={stats.teamMembers.length}
              sessionCount={stats.daily.length}
            />
          </div>

          {/* Daily chart */}
          <div className="animate-fade-in-up animate-delay-3" style={{ marginBottom: '24px' }}>
            <DailyChart data={dailyChartData} members={memberNames} />
          </div>

          {/* Bottom row */}
          <div
            className="grid gap-6 animate-fade-in-up animate-delay-4"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
          >
            <MemberTable data={stats.members} />
            <ModelPieChart data={stats.models} />
          </div>
        </div>
      </div>
    </main>
  );
}
