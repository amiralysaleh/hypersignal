export type SignalType = 'LONG' | 'SHORT';
export type SignalStatus = 'Open' | 'TP' | 'SL';

export interface SignalClusterFill {
  walletAddress: string;
  sz: string;
  px: string;
  side: string;
  time: number;
  leverage?: { value: string };
  startPosition: string;
}

export interface Signal {
  id: string;
  pair: string;
  type: SignalType;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  roi: string;
  status: SignalStatus;
  timestamp: string;
  leverage: string;
  liquidationPrice: string;
  margin: string;
  size: string;
  contributingWallets: number;
  contributingWalletAddresses: string[];
  takeProfitTargets: string[];
  stopLoss: string;
  clusterFills?: SignalClusterFill[];
}
