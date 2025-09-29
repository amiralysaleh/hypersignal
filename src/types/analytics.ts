export interface SuccessPredictionOutput {
  successProbability: number;
}

export interface CorrelationGroup {
  wallets: string[];
  tradeCount: number;
  coins: string[];
}

export interface WalletCorrelationsOutput {
  groups: CorrelationGroup[];
}
