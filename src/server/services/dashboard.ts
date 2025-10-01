import { getSignals, Signal } from './signals';
import { getTrackedAddresses } from './wallets';

export interface DashboardData {
  totalPnl: number;
  totalRoi: number;
  winRate: number;
  totalClosedSignals: number;
  activeSignals: number;
  trackedWallets: number;
  performanceChartData: { month: string; winrate: number }[];
  signalOutcomes: {
    'Take Profit': number;
    'Stop Loss': number;
    'Open': number;
  };
  recentSignals: {
    pair: string;
    type: Signal['type'];
    pnl: number;
    status: Signal['status'];
    contributingWallets: number;
  }[];
  topPairs: {
    pair: string;
    signals: number;
    winRate: number | null;
  }[];
  standoutSignals: {
    pair: string;
    type: Signal['type'];
    roi: number;
    pnl: number;
    status: Signal['status'];
    timestamp: string;
  }[];
  attentionSignals: {
    pair: string;
    type: Signal['type'];
    roi: number;
    pnl: number;
    status: Signal['status'];
    timestamp: string;
  }[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const trackedWallets = await getTrackedAddresses();
  const signals = await getSignals();

  let totalOpenPnl = 0;
  let totalOpenMargin = 0;
  let activeSignalsCount = 0;
  let tpCount = 0;
  let slCount = 0;
  const monthlyStats: Record<string, { tp: number; sl: number }> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pairStats = new Map<string, { total: number; wins: number; losses: number }>();
  const openSignalInsights: {
    pair: string;
    type: Signal['type'];
    roi: number;
    pnl: number;
    status: Signal['status'];
    timestamp: string;
  }[] = [];

  signals.forEach((signal) => {
    const stats = pairStats.get(signal.pair) ?? { total: 0, wins: 0, losses: 0 };
    stats.total += 1;
    if (signal.status === 'TP') {
      stats.wins += 1;
    } else if (signal.status === 'SL') {
      stats.losses += 1;
    }
    pairStats.set(signal.pair, stats);

    if (signal.status === 'Open') {
      activeSignalsCount += 1;
      totalOpenPnl += parseFloat(signal.pnl);
      totalOpenMargin += parseFloat(signal.margin);
      const roi = parseFloat(signal.roi);
      const pnl = parseFloat(signal.pnl);
      openSignalInsights.push({
        pair: signal.pair,
        type: signal.type,
        roi: Number.isFinite(roi) ? roi : 0,
        pnl: Number.isFinite(pnl) ? pnl : 0,
        status: signal.status,
        timestamp: signal.timestamp,
      });
    } else {
      const signalDate = new Date(signal.timestamp);
      const monthKey = `${signalDate.getFullYear()}-${signalDate.getMonth()}`;
      monthlyStats[monthKey] = monthlyStats[monthKey] ?? { tp: 0, sl: 0 };

      if (signal.status === 'TP') {
        tpCount += 1;
        monthlyStats[monthKey].tp += 1;
      } else if (signal.status === 'SL') {
        slCount += 1;
        monthlyStats[monthKey].sl += 1;
      }
    }
  });

  const totalClosedSignals = tpCount + slCount;
  const winRate = totalClosedSignals > 0 ? (tpCount / totalClosedSignals) * 100 : 0;
  const totalRoi = totalOpenMargin > 0 ? (totalOpenPnl / totalOpenMargin) * 100 : 0;

  const recentSignals = signals.slice(0, 5).map((signal) => ({
    pair: signal.pair,
    type: signal.type,
    pnl: parseFloat(signal.pnl),
    status: signal.status,
    contributingWallets: signal.contributingWallets,
  }));

  const performanceChartData: { month: string; winrate: number }[] = [];
  const today = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const stats = monthlyStats[monthKey] ?? { tp: 0, sl: 0 };
    const totalTrades = stats.tp + stats.sl;
    const monthlyWinrate = totalTrades > 0 ? (stats.tp / totalTrades) * 100 : 0;
    performanceChartData.push({ month: monthNames[d.getMonth()], winrate: parseFloat(monthlyWinrate.toFixed(1)) });
  }

  return {
    totalPnl: totalOpenPnl,
    totalRoi,
    winRate,
    totalClosedSignals,
    activeSignals: activeSignalsCount,
    trackedWallets: trackedWallets.length,
    recentSignals,
    performanceChartData,
    signalOutcomes: {
      'Take Profit': tpCount,
      'Stop Loss': slCount,
      Open: activeSignalsCount,
    },
    topPairs: Array.from(pairStats.entries())
      .map(([pair, { total, wins, losses }]) => {
        const closed = wins + losses;
        const winRate = closed > 0 ? (wins / closed) * 100 : null;
        return {
          pair,
          signals: total,
          winRate: winRate === null ? null : parseFloat(winRate.toFixed(1)),
        };
      })
      .sort((a, b) => b.signals - a.signals)
      .slice(0, 5),
    standoutSignals: openSignalInsights
      .filter((signal) => signal.roi > 0)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 3),
    attentionSignals: openSignalInsights
      .filter((signal) => signal.roi <= 0)
      .sort((a, b) => a.roi - b.roi)
      .slice(0, 3),
  };
}
