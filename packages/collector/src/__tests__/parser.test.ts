import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseJsonlFile, aggregateByModel } from '../parser.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'ccusage-worv-test-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('parseJsonlFile', () => {
  it('parses valid JSONL lines with usage data', () => {
    const file = join(TEST_DIR, 'test.jsonl');
    const lines = [
      JSON.stringify({
        timestamp: '2026-02-25T10:00:00Z',
        sessionId: 'sess-1',
        model: 'claude-sonnet-4-6',
        costUSD: 0.05,
        usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 200, cacheReadInputTokens: 100 }
      }),
      JSON.stringify({
        timestamp: '2026-02-25T10:05:00Z',
        sessionId: 'sess-1',
        model: 'claude-sonnet-4-6',
        costUSD: 0.03,
        usage: { inputTokens: 800, outputTokens: 300 }
      })
    ];
    writeFileSync(file, lines.join('\n'));

    const entries = parseJsonlFile(file);
    expect(entries).toHaveLength(2);
    expect(entries[0].model).toBe('claude-sonnet-4-6');
    expect(entries[0].usage?.inputTokens).toBe(1000);
    expect(entries[1].usage?.outputTokens).toBe(300);
  });

  it('skips malformed lines', () => {
    const file = join(TEST_DIR, 'bad.jsonl');
    writeFileSync(file, 'not-json\n{"timestamp":"2026-02-25T10:00:00Z","sessionId":"s1","model":"claude-sonnet-4-6","usage":{"inputTokens":1,"outputTokens":1}}\n');

    const entries = parseJsonlFile(file);
    expect(entries).toHaveLength(1);
  });

  it('skips lines without model or usage', () => {
    const file = join(TEST_DIR, 'partial.jsonl');
    writeFileSync(file, '{"timestamp":"t","sessionId":"s"}\n{"timestamp":"t","sessionId":"s","model":"m","usage":{"inputTokens":1,"outputTokens":1}}\n');

    const entries = parseJsonlFile(file);
    expect(entries).toHaveLength(1);
  });
});

describe('aggregateByModel', () => {
  it('sums tokens by model', () => {
    const entries = [
      { timestamp: 't1', sessionId: 's', model: 'claude-sonnet-4-6', usage: { inputTokens: 100, outputTokens: 50 } },
      { timestamp: 't2', sessionId: 's', model: 'claude-sonnet-4-6', usage: { inputTokens: 200, outputTokens: 100 } },
      { timestamp: 't3', sessionId: 's', model: 'claude-opus-4-6', usage: { inputTokens: 500, outputTokens: 250 } },
    ];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(2);

    const sonnet = result.find(r => r.model === 'claude-sonnet-4-6');
    expect(sonnet?.inputTokens).toBe(300);
    expect(sonnet?.outputTokens).toBe(150);

    const opus = result.find(r => r.model === 'claude-opus-4-6');
    expect(opus?.inputTokens).toBe(500);
    expect(opus?.outputTokens).toBe(250);
  });

  it('handles entries without usage gracefully', () => {
    const entries = [
      { timestamp: 't1', sessionId: 's', model: 'claude-sonnet-4-6' },
    ];
    const result = aggregateByModel(entries);
    expect(result).toHaveLength(0);
  });
});
