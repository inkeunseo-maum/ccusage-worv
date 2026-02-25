'use client';

interface MemberData {
  memberName: string;
  totalCost: number;
  totalTokens: number;
}

interface Props {
  data: MemberData[];
}

const MEMBER_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const RANK_STYLES: Record<number, { badge: string; color: string }> = {
  0: { badge: '#f59e0b', color: '#fafafa' },
  1: { badge: '#71717a', color: '#fafafa' },
  2: { badge: '#92400e', color: '#fcd34d' },
};

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function MemberTable({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.totalCost - a.totalCost);
  const maxCost = sorted[0]?.totalCost || 1;

  return (
    <div
      className="glass-card"
      style={{ borderRadius: '16px', padding: '24px' }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#fafafa',
            letterSpacing: '-0.01em',
            marginBottom: '2px',
          }}
        >
          팀원별 사용량
        </h2>
        <p style={{ fontSize: '12px', color: '#52525b' }}>Cost distribution per member</p>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {sorted.map((m, idx) => {
          const pct = (m.totalCost / maxCost) * 100;
          const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
          const rankStyle = RANK_STYLES[idx];

          return (
            <div
              key={m.memberName}
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
              {/* Top row: rank, avatar, name, cost */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                {/* Rank */}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: rankStyle ? rankStyle.color : '#52525b',
                    background: rankStyle ? rankStyle.badge : 'transparent',
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>

                {/* Avatar */}
                <div
                  style={{
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
                  }}
                >
                  {getInitial(m.memberName)}
                </div>

                {/* Name */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#e4e4e7',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.memberName}
                </span>

                {/* Cost */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#fafafa',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ${m.totalCost.toFixed(2)}
                  </span>
                  <div style={{ fontSize: '10px', color: '#52525b', marginTop: '1px' }}>
                    {formatTokens(m.totalTokens)} tok
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="progress-bar"
                style={{ marginLeft: '28px' }}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
