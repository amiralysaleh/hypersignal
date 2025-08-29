
'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'settings.json');

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

async function readData<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Ensure all default keys are present
    const parsedContent = JSON.parse(fileContent);
    return { ...defaultValue, ...parsedContent };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    throw error;
  }
}

async function writeData<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}


export async function getSettings(): Promise<Settings> {
  return await readData(SETTINGS_FILE_PATH, defaultSettings);
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  await writeData(SETTINGS_FILE_PATH, newSettings);
}
