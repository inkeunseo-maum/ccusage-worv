'use client';

import { useState } from 'react';
import type { RollingUsage } from '@/lib/types';

interface Props {
  rolling5h: RollingUsage[];
  rolling7d: RollingUsage[];
}

const MEMBER_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function RollingUsagePanel({ rolling5h, rolling7d }: Props) {
  const [tab, setTab] = useState<'5h' | '7d'>('5h');

  const rows = tab === '5h' ? rolling5h : rolling7d;
  const hasData = rows.some(r => r.totalCostUsd > 0 || r.sessionCount > 0);

  return (
    <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
      {/* Header + Tab */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: '2px' }}>
            사용량 윈도우
          </h2>
          <p style={{ fontSize: '12px', color: '#52525b' }}>5h / 7d rolling usage per member</p>
        </div>
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '2px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {(['5h', '7d'] as const).map(t => (
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
              {t === '5h' ? '5시간' : '7일'}
            </button>
          ))}
        </div>
      </div>

      {/* Member rows or empty state */}
      {!hasData ? (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>~</div>
          데이터가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.filter(r => r.totalCostUsd > 0 || r.sessionCount > 0).map((m, idx) => {
            const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
            const totalTokens = m.totalInputTokens + m.totalOutputTokens;

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
                {/* Avatar, name, cost */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

                  {/* Cost + tokens/sessions */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#fafafa',
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: '2px',
                    }}>
                      ${m.totalCostUsd.toFixed(2)}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      fontSize: '11px',
                      color: '#52525b',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      <span>{formatTokens(totalTokens)} tok</span>
                      <span>{m.sessionCount} sess</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
