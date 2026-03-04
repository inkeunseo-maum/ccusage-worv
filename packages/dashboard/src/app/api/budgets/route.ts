import { NextResponse } from 'next/server';
import { getAllBudgets, upsertBudget, getAllMembers } from '@/lib/repository';

export async function GET() {
  try {
    const [budgets, members] = await Promise.all([getAllBudgets(), getAllMembers()]);
    return NextResponse.json({ budgets, members });
  } catch (err) {
    console.error('Failed to fetch budgets:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, budgetType, budgetUsd } = body;

    if (!budgetType || !['weekly', 'monthly'].includes(budgetType)) {
      return NextResponse.json({ error: 'Invalid budgetType' }, { status: 400 });
    }
    if (typeof budgetUsd !== 'number' || isNaN(budgetUsd) || budgetUsd < 0 || budgetUsd > 1_000_000) {
      return NextResponse.json({ error: 'Invalid budgetUsd' }, { status: 400 });
    }

    if (memberId !== null && memberId !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof memberId !== 'string' || !uuidRegex.test(memberId)) {
        return NextResponse.json({ error: 'Invalid memberId format' }, { status: 400 });
      }
    }

    await upsertBudget(memberId || null, budgetType, budgetUsd);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to upsert budget:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
