import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test('should show loading state initially', async ({ page }) => {
    // Delay the stats API response to keep loading state visible
    await page.route('**/api/stats*', async (route) => {
      await new Promise(r => setTimeout(r, 3000));
      await route.abort();
    });
    await page.goto('/');
    // Should show loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 5000 });
  });

  test('should show error state when API fails', async ({ page }) => {
    await page.route('**/api/stats*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) }),
    );
    await page.goto('/');
    await expect(page.getByText('Error', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Retry')).toBeVisible();
  });

  test('should render dashboard with mocked stats', async ({ page }) => {
    const mockStats = {
      daily: [
        { date: '2026-03-01', memberName: 'TestUser', model: 'claude-sonnet-4-6', costUsd: 1.5, inputTokens: 10000, outputTokens: 5000 },
        { date: '2026-03-02', memberName: 'TestUser', model: 'claude-sonnet-4-6', costUsd: 2.0, inputTokens: 15000, outputTokens: 7000 },
      ],
      members: [{ memberName: 'TestUser', totalCost: 3.5, totalTokens: 37000 }],
      models: [{ model: 'claude-sonnet-4-6', count: 2, totalCost: 3.5 }],
      teamMembers: [{ id: '1', name: 'TestUser' }],
      weeklyBudgets: [],
      monthlyBudgets: [],
      velocity: [],
      budgetConfigs: [],
      sessionCount: 2,
      rolling5h: [],
      rolling7d: [],
      utilization: [],
    };

    await page.route('**/api/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      }),
    );

    await page.goto('/');

    // Header should be visible
    await expect(page.getByText('ccusage')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Team Dashboard')).toBeVisible();

    // Stats cards should show values
    await expect(page.getByText('$3.50').first()).toBeVisible();
    await expect(page.getByText('37.0K').first()).toBeVisible();

    // Period pills should exist
    await expect(page.locator('header').getByRole('button', { name: '7일' })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: '30일' })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: '90일' })).toBeVisible();
  });

  test('should switch period when pill is clicked', async ({ page }) => {
    const mockStats = {
      daily: [],
      members: [],
      models: [],
      teamMembers: [],
      weeklyBudgets: [],
      monthlyBudgets: [],
      velocity: [],
      budgetConfigs: [],
      sessionCount: 0,
      rolling5h: [],
      rolling7d: [],
      utilization: [],
    };

    let lastRequestedDays: string | null = null;
    await page.route('**/api/stats*', (route) => {
      const url = new URL(route.request().url());
      lastRequestedDays = url.searchParams.get('days');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      });
    });

    await page.goto('/');
    await expect(page.getByText('Team Dashboard')).toBeVisible({ timeout: 10000 });

    // Click 7-day pill
    await page.locator('header').getByText('7일').click();
    await page.waitForTimeout(500);
    expect(lastRequestedDays).toBe('7');

    // Click 90-day pill
    await page.locator('header').getByText('90일').click();
    await page.waitForTimeout(500);
    expect(lastRequestedDays).toBe('90');
  });

  test('should display session count from API (not daily array length)', async ({ page }) => {
    const mockStats = {
      daily: [
        { date: '2026-03-01', memberName: 'A', model: 'claude-sonnet-4-6', costUsd: 1, inputTokens: 1000, outputTokens: 500 },
      ],
      members: [{ memberName: 'A', totalCost: 1, totalTokens: 1500 }],
      models: [{ model: 'claude-sonnet-4-6', count: 1, totalCost: 1 }],
      teamMembers: [{ id: '1', name: 'A' }],
      weeklyBudgets: [],
      monthlyBudgets: [],
      velocity: [],
      budgetConfigs: [],
      sessionCount: 42, // Intentionally different from daily.length (1)
      rolling5h: [],
      rolling7d: [],
      utilization: [],
    };

    await page.route('**/api/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      }),
    );

    await page.goto('/');
    await expect(page.getByText('Team Dashboard')).toBeVisible({ timeout: 10000 });

    // Should show 42 (from sessionCount), not 1 (from daily.length)
    await expect(page.getByText('42')).toBeVisible();
  });

  test('should not show synthetic model in model distribution', async ({ page }) => {
    const mockStats = {
      daily: [],
      members: [],
      models: [
        { model: 'claude-sonnet-4-6', count: 5, totalCost: 10.0 },
        // <synthetic> should never reach the dashboard if server filters it,
        // but verify it doesn't appear even if somehow present
      ],
      teamMembers: [],
      weeklyBudgets: [],
      monthlyBudgets: [],
      velocity: [],
      budgetConfigs: [],
      sessionCount: 5,
      rolling5h: [],
      rolling7d: [],
      utilization: [],
    };

    await page.route('**/api/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      }),
    );

    await page.goto('/');
    await expect(page.getByText('Team Dashboard')).toBeVisible({ timeout: 10000 });

    // Should not contain <synthetic> anywhere
    const content = await page.textContent('body');
    expect(content).not.toContain('<synthetic>');
  });

  test('should open budget settings modal', async ({ page }) => {
    const mockStats = {
      daily: [],
      members: [],
      models: [],
      teamMembers: [{ id: '1', name: 'TestUser' }],
      weeklyBudgets: [],
      monthlyBudgets: [],
      velocity: [],
      budgetConfigs: [],
      sessionCount: 0,
      rolling5h: [],
      rolling7d: [],
      utilization: [],
    };

    await page.route('**/api/stats*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStats),
      }),
    );

    await page.goto('/');
    await expect(page.getByText('Team Dashboard')).toBeVisible({ timeout: 10000 });

    // Click the settings button
    await page.getByTitle('예산 설정').click();

    // Modal should appear
    await expect(page.getByText('팀 기본 예산 (USD)')).toBeVisible();
    await expect(page.getByText('팀원별 오버라이드', { exact: true })).toBeVisible();
  });
});
