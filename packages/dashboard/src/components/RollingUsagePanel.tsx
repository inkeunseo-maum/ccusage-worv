'use client';

import type { RollingUsage, UtilizationSnapshot } from '@/lib/types';

interface Props {
  utilization: UtilizationSnapshot[];
  rolling5h: RollingUsage[];
  rolling7d: RollingUsage[];
}

const MEMBER_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 50) return '#f59e0b';
  return '#22c55e';
}

function formatPct(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return `${Math.round(v)}%`;
}

function UtilBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  const color = getBarColor(pct);
  const hasValue = value !== null && value !== undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
      <span style={{ fontSize: '10px', color: '#71717a', width: '18px', flexShrink: 0, textAlign: 'right' }}>{label}</span>
      <div style={{
        flex: 1,
        height: '6px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {hasValue && (
          <div style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            borderRadius: '3px',
            background: color,
            transition: 'width 0.3s ease',
          }} />
        )}
      </div>
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        color: hasValue ? color : '#3f3f46',
        width: '32px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatPct(value)}
      </span>
    </div>
  );
}

export function RollingUsagePanel({ utilization, rolling5h, rolling7d }: Props) {
  const hasUtilization = utilization.length > 0;

  // Build a cost lookup from rolling data
  const costMap5h = new Map(rolling5h.map(r => [r.memberName, r.totalCostUsd]));
  const costMap7d = new Map(rolling7d.map(r => [r.memberName, r.totalCostUsd]));

  return (
    <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: '2px' }}>
          Rate Limit Status
        </h2>
        <p style={{ fontSize: '12px', color: '#52525b' }}>Anthropic API 5h / 7d utilization</p>
      </div>

      {/* Utilization rows or empty state */}
      {!hasUtilization ? (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#52525b',
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>~</div>
          아직 수집된 데이터가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {utilization.map((m, idx) => {
            const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
            const cost5h = costMap5h.get(m.memberName) ?? 0;
            const cost7d = costMap7d.get(m.memberName) ?? 0;

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

                  {/* Name + Bars */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#e4e4e7',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {m.memberName}
                      </span>
                      {(cost5h > 0 || cost7d > 0) && (
                        <span style={{ fontSize: '10px', color: '#3f3f46', flexShrink: 0, marginLeft: '8px' }}>
                          5h ${cost5h.toFixed(2)} · 7d ${cost7d.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <UtilBar label="5h" value={m.fiveHourPct} />
                      <UtilBar label="7d" value={m.sevenDayPct} />
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
