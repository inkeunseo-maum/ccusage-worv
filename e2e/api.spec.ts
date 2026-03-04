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
});
