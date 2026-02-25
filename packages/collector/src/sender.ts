import type { UsageReport } from '@ccusage-worv/shared';

export async function sendReport(serverUrl: string, report: UsageReport, apiKey?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${serverUrl}/api/usage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(report),
  });

  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}: ${await res.text()}`);
  }
}
