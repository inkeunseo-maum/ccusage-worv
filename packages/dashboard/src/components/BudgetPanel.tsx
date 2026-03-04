'use client';

import { useState } from 'react';
import type { MemberBudgetUsage, UsageVelocity } from '@/lib/types';

interface Props {
  weeklyBudgets: MemberBudgetUsage[];
  monthlyBudgets: MemberBudgetUsage[];
  velocity: UsageVelocity[];
}

const MEMBER_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getBarColor(percent: number): string {
  if (percent >= 80) return '#ef4444';
  if (percent >= 50) return '#f59e0b';
  return '#10b981';
}

function getBarGlow(percent: number): string {
  if (percent >= 80) return 'rgba(239,68,68,0.3)';
  if (percent >= 50) return 'rgba(245,158,11,0.2)';
  return 'rgba(16,185,129,0.15)';
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function estimateDaysLeft(budgetUsd: number, usedUsd: number, dailyAvg: number): string {
  if (dailyAvg <= 0 || budgetUsd <= 0) return '-';
  const remaining = budgetUsd - usedUsd;
  if (remaining <= 0) return '0d';
  const days = Math.floor(remaining / dailyAvg);
  return `${days}d`;
}

export function BudgetPanel({ weeklyBudgets, monthlyBudgets, velocity }: Props) {
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');

  const budgets = tab === 'weekly' ? weeklyBudgets : monthlyBudgets;
  const velocityMap = new Map(velocity.map(v => [v.memberId, v]));

  const hasBudgets = budgets.some(b => b.budgetUsd > 0);

  if (!hasBudgets) {
    return (
      <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: '2px' }}>
            예산 추적
          </h2>
          <p style={{ fontSize: '12px', color: '#52525b' }}>Budget tracking per member</p>
        </div>
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>$</div>
          예산이 설정되지 않았습니다
          <br />
          <span style={{ fontSize: '11px', color: '#3f3f46' }}>
            설정 아이콘을 눌러 팀/개인 예산을 설정하세요
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
      {/* Header + Tab */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: '2px' }}>
            예산 추적
          </h2>
          <p style={{ fontSize: '12px', color: '#52525b' }}>Budget tracking per member</p>
        </div>
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '2px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {(['weekly', 'monthly'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: 'none',
                color: tab === t ? '#fafafa' : '#71717a',
                background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
            >
              {t === 'weekly' ? '주간' : '월간'}
            </button>
          ))}
        </div>
      </div>

      {/* Member rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {budgets.filter(b => b.budgetUsd > 0).map((m, idx) => {
          const vel = velocityMap.get(m.memberId);
          const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
          const barColor = getBarColor(m.usagePercent);
          const barGlow = getBarGlow(m.usagePercent);
          const daysLeft = vel ? estimateDaysLeft(m.budgetUsd, m.usedUsd, vel.dailyAvgUsd) : '-';
          const pctClamped = Math.min(m.usagePercent, 100);

          return (
            <div
              key={m.memberId}
              style={{
                borderRadius: '10px',
                padding: '12px',
                transition: 'background 0.15s ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {/* Top: avatar, name, cost/budget */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                {/* Avatar */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${color}33 0%, ${color}66 100%)`,
                  border: `1px solid ${color}44`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: color,
                  flexShrink: 0,
                }}>
                  {getInitial(m.memberName)}
                </div>

                {/* Name */}
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#e4e4e7',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {m.memberName}
                </span>

                {/* Cost / Budget */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#fafafa',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      ${m.usedUsd.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#52525b' }}>
                      / ${m.budgetUsd.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: '6px',
                borderRadius: '9999px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                marginBottom: '8px',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: '9999px',
                  width: `${pctClamped}%`,
                  background: barColor,
                  boxShadow: `0 0 8px ${barGlow}`,
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
              </div>

              {/* Bottom: percent, velocity, days left */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#71717a',
              }}>
                <span style={{ color: barColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {m.usagePercent.toFixed(1)}%
                </span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {vel && vel.dailyAvgUsd > 0 && (
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      ${vel.dailyAvgUsd.toFixed(2)}/day
                    </span>
                  )}
                  {vel && vel.dailyAvgUsd > 0 && (
                    <span style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: daysLeft === '0d' ? '#ef4444' : '#71717a',
                    }}>
                      {daysLeft} left
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
