import { NextResponse } from 'next/server';
import { getDailyUsage, getMemberUsage, getModelDistribution, getAllMembers, getMemberBudgetUsage, getUsageVelocity, getAllBudgets } from '@/lib/repository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const [daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs] = await Promise.all([
      getDailyUsage(days),
      getMemberUsage(days),
      getModelDistribution(days),
      getAllMembers(),
      getMemberBudgetUsage('weekly'),
      getMemberBudgetUsage('monthly'),
      getUsageVelocity(),
      getAllBudgets(),
    ]);

    return NextResponse.json({ daily, members, models, teamMembers, weeklyBudgets, monthlyBudgets, velocity, budgetConfigs });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
