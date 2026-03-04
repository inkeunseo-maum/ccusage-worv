import { NextResponse } from 'next/server';
import { insertUsageReport } from '@/lib/repository';
import type { UsageReport } from '@/lib/types';
import { estimateCost } from '@/lib/pricing';

const MAX_RECORDS_PER_REPORT = 100;
const MAX_STRING_LENGTH = 256;
const MAX_SESSION_ID_LENGTH = 512;
const MAX_TOKENS = 100_000_000;

function isValidISODate(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function isNonNegativeInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export async function POST(request: Request) {
  try {
    const report: UsageReport = await request.json();

    if (!report.memberName || typeof report.memberName !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing memberName' }, { status: 400 });
    }
    if (report.memberName.length > MAX_STRING_LENGTH) {
      return NextResponse.json({ error: 'memberName too long' }, { status: 400 });
    }
    if (!report.sessionId || typeof report.sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing sessionId' }, { status: 400 });
    }
    if (report.sessionId.length > MAX_SESSION_ID_LENGTH) {
      return NextResponse.json({ error: 'sessionId too long' }, { status: 400 });
    }
    if (!Array.isArray(report.records) || report.records.length === 0) {
      return NextResponse.json({ error: 'Records array is empty or missing' }, { status: 400 });
    }
    if (report.records.length > MAX_RECORDS_PER_REPORT) {
      return NextResponse.json({ error: `Too many records (max ${MAX_RECORDS_PER_REPORT})` }, { status: 400 });
    }

    // Validate and recalculate cost for each record
    const validatedRecords = [];
    for (const r of report.records) {
      if (!r.model || typeof r.model !== 'string') {
        return NextResponse.json({ error: 'Invalid or missing model in record' }, { status: 400 });
      }
      if (r.model.length > MAX_STRING_LENGTH) {
        return NextResponse.json({ error: 'model name too long' }, { status: 400 });
      }
      // Filter out synthetic model entries
      if (r.model === '<synthetic>') continue;

      if (!isNonNegativeInt(r.inputTokens) || !isNonNegativeInt(r.outputTokens)) {
        return NextResponse.json({ error: 'Token counts must be non-negative integers' }, { status: 400 });
      }
      if (r.inputTokens > MAX_TOKENS || r.outputTokens > MAX_TOKENS) {
        return NextResponse.json({ error: 'Token count exceeds maximum' }, { status: 400 });
      }
      if (!isValidISODate(r.recordedAt)) {
        return NextResponse.json({ error: 'Invalid recordedAt date' }, { status: 400 });
      }

      const cacheCreationTokens = isNonNegativeInt(r.cacheCreationTokens) ? r.cacheCreationTokens : 0;
      const cacheReadTokens = isNonNegativeInt(r.cacheReadTokens) ? r.cacheReadTokens : 0;

      // Server-side cost recalculation — ignore client-sent costUsd
      const costUsd = estimateCost(r.model, r.inputTokens, r.outputTokens, cacheCreationTokens, cacheReadTokens);

      validatedRecords.push({
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        costUsd,
        projectName: typeof r.projectName === 'string' ? r.projectName.slice(0, MAX_STRING_LENGTH) : '',
        recordedAt: r.recordedAt,
      });
    }

    if (validatedRecords.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid records after filtering' });
    }

    await insertUsageReport({ ...report, records: validatedRecords });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save usage report:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
