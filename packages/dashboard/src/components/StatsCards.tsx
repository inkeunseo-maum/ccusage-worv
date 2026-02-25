'use client';

interface Props {
  totalCost: number;
  totalTokens: number;
  memberCount: number;
  sessionCount: number;
}

const CARD_DEFS = [
  {
    key: 'cost',
    label: '총 비용',
    icon: '$',
    accentColor: '#6366f1',
    glowColor: 'rgba(99,102,241,0.12)',
    borderTopColor: 'rgba(99,102,241,0.5)',
  },
  {
    key: 'tokens',
    label: '총 토큰',
    icon: '◈',
    accentColor: '#10b981',
    glowColor: 'rgba(16,185,129,0.12)',
    borderTopColor: 'rgba(16,185,129,0.5)',
  },
  {
    key: 'members',
    label: '팀원 수',
    icon: '⬡',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.12)',
    borderTopColor: 'rgba(245,158,11,0.5)',
  },
  {
    key: 'sessions',
    label: '세션 수',
    icon: '◎',
    accentColor: '#f43f5e',
    glowColor: 'rgba(244,63,94,0.12)',
    borderTopColor: 'rgba(244,63,94,0.5)',
  },
];

export function StatsCards({ totalCost, totalTokens, memberCount, sessionCount }: Props) {
  const values = {
    cost: `$${totalCost.toFixed(2)}`,
    tokens: formatNumber(totalTokens),
    members: String(memberCount),
    sessions: String(sessionCount),
  };

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}
    >
      {CARD_DEFS.map((def) => (
        <StatCard
          key={def.key}
          label={def.label}
          value={values[def.key as keyof typeof values]}
          icon={def.icon}
          accentColor={def.accentColor}
          glowColor={def.glowColor}
          borderTopColor={def.borderTopColor}
        />
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accentColor: string;
  glowColor: string;
  borderTopColor: string;
}

function StatCard({ label, value, icon, accentColor, glowColor, borderTopColor }: StatCardProps) {
  return (
    <div
      className="glass-card"
      style={{
        borderRadius: '12px',
        padding: '20px',
        borderTop: `1px solid ${borderTopColor}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = `0 8px 32px ${glowColor}`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Background glow blob */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: glowColor,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      {/* Icon badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: glowColor,
          border: `1px solid ${borderTopColor}`,
          color: accentColor,
          fontSize: '14px',
          marginBottom: '12px',
        }}
      >
        {icon}
      </div>

      {/* Label */}
      <p
        style={{
          fontSize: '11px',
          fontWeight: 500,
          color: '#71717a',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        {label}
      </p>

      {/* Value */}
      <p
        style={{
          fontSize: '26px',
          fontWeight: 700,
          color: '#fafafa',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
