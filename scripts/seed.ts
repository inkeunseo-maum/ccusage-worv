// scripts/seed.ts
import { MODEL_PRICING, estimateCost } from '../packages/dashboard/src/lib/pricing';

const SERVER = process.argv[2] || 'http://localhost:3000';

const MEMBERS = ['김인근', '박지훈', '이서연', '최동현', '정수민'];
const MODELS = Object.keys(MODEL_PRICING);

async function seed() {
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);

    for (const member of MEMBERS) {
      if (Math.random() < 0.3) continue;

      const model = MODELS[Math.floor(Math.random() * MODELS.length)];
      const inputTokens = Math.floor(Math.random() * 50000) + 1000;
      const outputTokens = Math.floor(Math.random() * 20000) + 500;
      const cacheCreationTokens = Math.floor(inputTokens * 0.3);
      const cacheReadTokens = Math.floor(inputTokens * 0.5);

      const report = {
        memberName: member,
        sessionId: `seed-${member}-${dayOffset}-${Date.now()}`,
        records: [{
          model,
          inputTokens,
          outputTokens,
          cacheCreationTokens,
          cacheReadTokens,
          costUsd: estimateCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens),
          projectName: ['worv-web', 'worv-api', 'worv-ml'][Math.floor(Math.random() * 3)],
          recordedAt: date.toISOString(),
        }],
        reportedAt: new Date().toISOString(),
      };

      const res = await fetch(`${SERVER}/api/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!res.ok) console.error(`Failed for ${member}: ${res.status}`);
    }
  }
  console.log('✓ Seed data inserted');
}

seed().catch(console.error);
