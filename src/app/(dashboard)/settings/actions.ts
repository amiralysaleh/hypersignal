'use server';

import { getSettings as loadSettings, saveSettings as persistSettings } from '@/backend/settings-service';
import type { Settings } from '@/types/settings';

export type { Settings } from '@/types/settings';

export async function getSettings(): Promise<Settings> {
  return loadSettings();
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  return persistSettings(newSettings);
}
