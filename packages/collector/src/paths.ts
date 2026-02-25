import { homedir } from 'node:os';
import { join } from 'node:path';

export function getClaudeProjectsDir(): string {
  const home = homedir();
  const platform = process.platform;

  if (platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) return join(appdata, 'claude', 'projects');
    return join(home, '.claude', 'projects');
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return join(xdgConfig, 'claude', 'projects');
  }
  return join(home, '.claude', 'projects');
}

export function getConfigPath(): string {
  return join(homedir(), '.ccusage-worv.json');
}

export function getClaudeSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}
