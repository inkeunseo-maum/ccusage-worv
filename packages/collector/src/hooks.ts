import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getClaudeSettingsPath } from './paths.js';

const HOOK_COMMAND = 'npx @ccusage-worv/collector collect';

export function registerHook(): void {
  const settingsPath = getClaudeSettingsPath();
  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  hooks['SessionEnd'] = [
    {
      hooks: [
        {
          type: 'command',
          command: HOOK_COMMAND,
          timeout: 30,
        },
      ],
    },
  ];

  settings.hooks = hooks;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function unregisterHook(): void {
  const settingsPath = getClaudeSettingsPath();
  if (!existsSync(settingsPath)) return;

  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  if (settings.hooks?.SessionEnd) {
    delete settings.hooks.SessionEnd;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
}
