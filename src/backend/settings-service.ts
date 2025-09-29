import * as path from 'path';
import { readJsonFile, writeJsonFile } from './storage';
import { Settings } from '@/types/settings';

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'settings.json');

const defaultSettings: Settings = {
  minWalletCount: 5,
  timeWindow: 10,
  minVolume: 1000,
  walletPollInterval: 60,
  pricePollInterval: 30,
  defaultStopLoss: -2.5,
  takeProfitTargets: '2.0, 3.5, 5.0',
  includeFunding: true,
  telegramBotToken: '',
  telegramChannelIds: '',
  monitoredPairs: 'ETH, BTC, SOL',
  quoteCurrencies: 'USDT, USDC',
  ignoredPairs: '',
};

export async function getSettings(): Promise<Settings> {
  const stored = await readJsonFile<Settings>(SETTINGS_FILE_PATH, defaultSettings);
  return { ...defaultSettings, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJsonFile(SETTINGS_FILE_PATH, { ...defaultSettings, ...settings });
}

export { defaultSettings };
