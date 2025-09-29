export interface DashboardPerformancePoint {
  month: string;
  winrate: number;
}

export interface DashboardSignalSummary {
  'Take Profit': number;
  'Stop Loss': number;
  'Open': number;
}

export interface DashboardRecentSignal {
  pair: string;
  type: 'LONG' | 'SHORT';
  pnl: number;
  status: 'TP' | 'SL' | 'Open';
  contributingWallets: number;
}

export interface DashboardData {
  totalPnl: number;
  totalRoi: number;
  winRate: number;
  totalClosedSignals: number;
  activeSignals: number;
  trackedWallets: number;
  performanceChartData: DashboardPerformancePoint[];
  signalOutcomes: DashboardSignalSummary;
  recentSignals: DashboardRecentSignal[];
}
