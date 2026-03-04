'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetConfig, TeamMemberSummary } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  budgetConfigs: BudgetConfig[];
  teamMembers: TeamMemberSummary[];
  onSaved: () => void;
}

export function BudgetSettings({ isOpen, onClose, budgetConfigs, teamMembers, onSaved }: Props) {
  const [teamWeekly, setTeamWeekly] = useState('');
  const [teamMonthly, setTeamMonthly] = useState('');
  const [memberOverrides, setMemberOverrides] = useState<Record<string, { weekly: string; monthly: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const teamW = budgetConfigs.find(b => b.memberId === null && b.budgetType === 'weekly');
    const teamM = budgetConfigs.find(b => b.memberId === null && b.budgetType === 'monthly');
    setTeamWeekly(teamW ? String(teamW.budgetUsd) : '');
    setTeamMonthly(teamM ? String(teamM.budgetUsd) : '');

    const overrides: Record<string, { weekly: string; monthly: string }> = {};
    for (const m of teamMembers) {
      const w = budgetConfigs.find(b => b.memberId === m.id && b.budgetType === 'weekly');
      const mo = budgetConfigs.find(b => b.memberId === m.id && b.budgetType === 'monthly');
      if (w || mo) {
        overrides[m.id] = {
          weekly: w ? String(w.budgetUsd) : '',
          monthly: mo ? String(mo.budgetUsd) : '',
        };
      }
    }
    setMemberOverrides(overrides);
  }, [isOpen, budgetConfigs, teamMembers]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const requests: Promise<Response>[] = [];

      // 팀 전체 기본값
      if (teamWeekly) {
        requests.push(fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: null, budgetType: 'weekly', budgetUsd: parseFloat(teamWeekly) }),
        }));
      }
      if (teamMonthly) {
        requests.push(fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: null, budgetType: 'monthly', budgetUsd: parseFloat(teamMonthly) }),
        }));
      }

      // 개별 오버라이드
      for (const [memberId, vals] of Object.entries(memberOverrides)) {
        if (vals.weekly) {
          requests.push(fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, budgetType: 'weekly', budgetUsd: parseFloat(vals.weekly) }),
          }));
        }
        if (vals.monthly) {
          requests.push(fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, budgetType: 'monthly', budgetUsd: parseFloat(vals.monthly) }),
          }));
        }
      }

      await Promise.all(requests);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [teamWeekly, teamMonthly, memberOverrides, onSaved, onClose]);

  const toggleMemberOverride = (memberId: string) => {
    setMemberOverrides(prev => {
      if (prev[memberId]) {
        const next = { ...prev };
        delete next[memberId];
        return next;
      }
      return { ...prev, [memberId]: { weekly: '', monthly: '' } };
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        width: '100%',
        maxWidth: '440px',
        maxHeight: '80vh',
        overflow: 'auto',
        borderRadius: '16px',
        background: '#18181b',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        animation: 'fadeInUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fafafa' }}>
              예산 설정
            </h3>
            <button
              onClick={onClose}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#71717a',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
            >
              x
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#52525b', marginTop: '4px' }}>
            팀 전체 기본 예산과 팀원별 오버라이드를 설정합니다
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Team defaults */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              팀 기본 예산 (USD)
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <InputField label="주간" value={teamWeekly} onChange={setTeamWeekly} placeholder="50" />
              <InputField label="월간" value={teamMonthly} onChange={setTeamMonthly} placeholder="200" />
            </div>
          </div>

          {/* Member overrides */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              팀원별 오버라이드
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {teamMembers.map(m => {
                const hasOverride = memberOverrides[m.id] !== undefined;
                return (
                  <div key={m.id}>
                    <button
                      onClick={() => toggleMemberOverride(m.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: hasOverride ? 'rgba(99,102,241,0.08)' : 'transparent',
                        border: hasOverride ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        border: hasOverride ? '1px solid #6366f1' : '1px solid #52525b',
                        background: hasOverride ? '#6366f1' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        color: '#fff',
                        flexShrink: 0,
                      }}>
                        {hasOverride ? 'v' : ''}
                      </span>
                      <span style={{ fontSize: '13px', color: '#e4e4e7', flex: 1 }}>{m.name}</span>
                    </button>
                    {hasOverride && (
                      <div style={{ display: 'flex', gap: '12px', padding: '8px 0 0 22px' }}>
                        <InputField
                          label="주간"
                          value={memberOverrides[m.id].weekly}
                          onChange={(v) => setMemberOverrides(prev => ({ ...prev, [m.id]: { ...prev[m.id], weekly: v } }))}
                          placeholder={teamWeekly || '-'}
                        />
                        <InputField
                          label="월간"
                          value={memberOverrides[m.id].monthly}
                          onChange={(v) => setMemberOverrides(prev => ({ ...prev, [m.id]: { ...prev[m.id], monthly: v } }))}
                          placeholder={teamMonthly || '-'}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#a1a1aa',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fafafa',
              background: saving ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.8)',
              border: '1px solid rgba(99,102,241,0.4)',
              cursor: saving ? 'default' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: saving ? 'none' : '0 0 12px rgba(99,102,241,0.2)',
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'rgba(99,102,241,1)'; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'rgba(99,102,241,0.8)'; }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  );
}

function InputField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: '11px', color: '#71717a', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#52525b',
        }}>$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '7px 10px 7px 22px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#fafafa',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
      </div>
    </div>
  );
}
