import { NextResponse } from 'next/server';
import { insertUsageReport } from '@/lib/repository';
import type { UsageReport } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const report: UsageReport = await request.json();

    if (!report.memberName || !report.records?.length) {
      return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
    }

    await insertUsageReport(report);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save usage report:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
