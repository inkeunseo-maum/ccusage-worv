import { NextResponse } from 'next/server';
import { getDailyUsage, getMemberUsage, getModelDistribution, getAllMembers } from '@/lib/repository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const daily = getDailyUsage(days);
    const members = getMemberUsage(days);
    const models = getModelDistribution(days);
    const teamMembers = getAllMembers();

    return NextResponse.json({ daily, members, models, teamMembers });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
