export interface Settings {
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
}
