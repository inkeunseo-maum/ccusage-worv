import { NextResponse } from 'next/server';
import { getDailyUsage, getMemberUsage, getModelDistribution, getAllMembers, getMemberBudgetUsage, getUsageVelocity, getAllBudgets, getSessionCount, getRollingUsage5h, getRollingUsage7d, getLatestUtilization } from '@/lib/repository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: 'Invalid days parameter (1-365)' }, { status: 400 });
    }

    const [daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs, sessionCount, rolling5h, rolling7d, utilization] = await Promise.all([
      getDailyUsage(days),
      getMemberUsage(days),
      getModelDistribution(days),
      getAllMembers(),
      getMemberBudgetUsage('weekly'),
      getMemberBudgetUsage('monthly'),
      getUsageVelocity(),
      getAllBudgets(),
      getSessionCount(days),
      getRollingUsage5h(),
      getRollingUsage7d(),
      getLatestUtilization(),
    ]);

    return NextResponse.json({ daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs, sessionCount, rolling5h, rolling7d, utilization });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
