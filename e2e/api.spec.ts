import { test, expect } from '@playwright/test';

test.describe('POST /api/usage', () => {
  const validReport = {
    memberName: 'TestUser',
    sessionId: 'test-session-001',
    records: [
      {
        model: 'claude-sonnet-4-6',
        inputTokens: 10000,
        outputTokens: 5000,
        cacheCreationTokens: 3000,
        cacheReadTokens: 5000,
        costUsd: 0, // Should be recalculated server-side
        projectName: 'test-project',
        recordedAt: '2026-03-01T10:00:00Z',
      },
    ],
    reportedAt: '2026-03-01T10:30:00Z',
  };

  test('should reject request without memberName', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: { ...validReport, memberName: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('memberName');
  });

  test('should reject request without sessionId', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: { ...validReport, sessionId: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sessionId');
  });

  test('should reject request with empty records', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: { ...validReport, records: [] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Records');
  });

  test('should reject record with negative token count', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], inputTokens: -100 }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('non-negative');
  });

  test('should reject record with invalid date', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], recordedAt: 'not-a-date' }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('recordedAt');
  });

  test('should reject record with missing model', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], model: '' }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('model');
  });

  test('should filter out synthetic model records', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], model: '<synthetic>' }],
      },
    });
    // Should succeed but with no valid records message
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('should reject too many records', async ({ request }) => {
    const records = Array.from({ length: 101 }, (_, i) => ({
      ...validReport.records[0],
      model: `claude-sonnet-4-6`,
      recordedAt: `2026-03-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    const res = await request.post('/api/usage', {
      data: { ...validReport, records },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Too many');
  });

  test('should reject memberName exceeding max length', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: { ...validReport, memberName: 'A'.repeat(257) },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too long');
  });

  test('should reject sessionId exceeding max length', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: { ...validReport, sessionId: 'S'.repeat(513) },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too long');
  });

  test('should reject model name exceeding max length', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], model: 'M'.repeat(257) }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('too long');
  });

  test('should reject non-integer token count', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], inputTokens: 10.5 }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('non-negative');
  });

  test('should reject token count exceeding maximum', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], inputTokens: 100_000_001 }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('exceeds');
  });

  test('should accept report with utilization data', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        utilization: { fiveHour: 45.2, sevenDay: 12.8 },
      },
    });
    // May be 200 or 500 (Supabase not configured in test), but not 400
    expect(res.status()).not.toBe(400);
  });

  test('should truncate projectName to max length', async ({ request }) => {
    const res = await request.post('/api/usage', {
      data: {
        ...validReport,
        records: [{ ...validReport.records[0], projectName: 'P'.repeat(500) }],
      },
    });
    // Should not reject — projectName is truncated, not rejected
    expect(res.status()).not.toBe(400);
  });
});

test.describe('GET /api/stats', () => {
  test('should return stats JSON', async ({ request }) => {
    const res = await request.get('/api/stats?days=7');
    // May fail with 500 if Supabase is not configured, but should not be 404
    expect([200, 500]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body).toHaveProperty('daily');
      expect(body).toHaveProperty('members');
      expect(body).toHaveProperty('models');
      expect(body).toHaveProperty('teamMembers');
      expect(body).toHaveProperty('sessionCount');
    }
  });

  test('should reject invalid days parameter', async ({ request }) => {
    const res = await request.get('/api/stats?days=abc');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid days');
  });

  test('should reject days=0', async ({ request }) => {
    const res = await request.get('/api/stats?days=0');
    expect(res.status()).toBe(400);
  });

  test('should reject days exceeding 365', async ({ request }) => {
    const res = await request.get('/api/stats?days=366');
    expect(res.status()).toBe(400);
  });
});

test.describe('GET /api/install', () => {
  test('should return bash install script', async ({ request }) => {
    const res = await request.get('/api/install');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/plain');

    const body = await res.text();
    expect(body).toContain('#!/bin/bash');
    expect(body).toContain('ccusage-worv');
    // Verify synthetic filter is in the script
    expect(body).toContain('<synthetic>');
    // Verify prefix matching function is in the script
    expect(body).toContain('resolveModelKey');
  });

  test('should include fetchUtilization in install script', async ({ request }) => {
    const res = await request.get('/api/install');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('fetchUtilization');
    expect(body).toContain('api/oauth/usage');
    expect(body).toContain('anthropic-beta');
  });
});

test.describe('POST /api/budgets', () => {
  test('should reject invalid budgetType', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: null, budgetType: 'yearly', budgetUsd: 100 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('budgetType');
  });

  test('should reject negative budgetUsd', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: null, budgetType: 'weekly', budgetUsd: -10 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('budgetUsd');
  });

  test('should reject budgetUsd exceeding 1M', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: null, budgetType: 'weekly', budgetUsd: 1_000_001 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('budgetUsd');
  });

  test('should reject NaN budgetUsd', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: null, budgetType: 'weekly', budgetUsd: 'abc' },
    });
    expect(res.status()).toBe(400);
  });

  test('should reject invalid memberId format', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: 'not-a-uuid', budgetType: 'weekly', budgetUsd: 100 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('memberId');
  });

  test('should accept valid budget with null memberId (team default)', async ({ request }) => {
    const res = await request.post('/api/budgets', {
      data: { memberId: null, budgetType: 'weekly', budgetUsd: 100 },
    });
    // May be 200 or 500 (Supabase not configured), but not 400
    expect(res.status()).not.toBe(400);
  });
});
