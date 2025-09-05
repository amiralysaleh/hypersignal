const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'settings.json');

const defaultSettings = {
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

async function readData(filePath, defaultValue) {
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Ensure all default keys are present
    const parsedContent = JSON.parse(fileContent);
    return { ...defaultValue, ...parsedContent };
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    throw error;
  }
}

async function writeData(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function getSettings() {
  return await readData(SETTINGS_FILE_PATH, defaultSettings);
}

async function saveSettings(newSettings) {
  await writeData(SETTINGS_FILE_PATH, newSettings);
}

module.exports = {
  getSettings,
  saveSettings
};