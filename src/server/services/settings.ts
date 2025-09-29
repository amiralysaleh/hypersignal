import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

export type Settings = {
  minWalletCount: number;
  timeWindow: number;
  minVolume: number;
  walletPollInterval: number;
  pricePollInterval: number;
  defaultStopLoss: number;
  takeProfitTargets: string;
  includeFunding: boolean;
  telegramBotToken: string;
  telegramChannelIds: string;
  monitoredPairs: string;
  quoteCurrencies: string;
  ignoredPairs: string;
};

const SETTINGS_FILE_PATH = 'settings.json';

export const defaultSettings: Settings = {
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
  return readJsonFile(SETTINGS_FILE_PATH, defaultSettings);
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  await writeJsonFile(SETTINGS_FILE_PATH, newSettings);
}
