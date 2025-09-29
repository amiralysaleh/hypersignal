export interface Wallet {
  address: string;
  addedOn: string;
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  cooldowns: Record<string, string>;
  favorite: boolean;
}
