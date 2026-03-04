import { NextResponse } from 'next/server';
import { getDailyUsage, getMemberUsage, getModelDistribution, getAllMembers, getMemberBudgetUsage, getUsageVelocity, getAllBudgets, getSessionCount } from '@/lib/repository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const [daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs, sessionCount] = await Promise.all([
      getDailyUsage(days),
      getMemberUsage(days),
      getModelDistribution(days),
      getAllMembers(),
      getMemberBudgetUsage('weekly'),
      getMemberBudgetUsage('monthly'),
      getUsageVelocity(),
      getAllBudgets(),
      getSessionCount(days),
    ]);

    return NextResponse.json({ daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs, sessionCount });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
