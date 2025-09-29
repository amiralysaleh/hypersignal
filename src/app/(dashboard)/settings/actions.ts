'use server';

import type { Settings } from '@/server/services/settings';
import { getSettings as getSettingsService, saveSettings as saveSettingsService } from '@/server/services/settings';

export type { Settings };

export async function getSettings(): Promise<Settings> {
  return getSettingsService();
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  await saveSettingsService(newSettings);
}
