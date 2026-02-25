import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getConfigPath } from './paths.js';
import type { CollectorConfig } from '@ccusage-worv/shared';

export function loadConfig(): CollectorConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveConfig(config: CollectorConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}
