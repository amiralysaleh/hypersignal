'use server';

import { getSignals, Signal } from '@/app/(dashboard)/signals/actions';
import { getTrackedAddresses } from '../wallets/actions';

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
    type: 'LONG' | 'SHORT';
    pnl: number;
    status: 'TP' | 'SL' | 'Open';
    contributingWallets: number;
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
  const monthlyStats: { [key: string]: { tp: number, sl: number } } = {};
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  signals.forEach(signal => {
    if (signal.status === 'Open') {
      activeSignalsCount++;
      totalOpenPnl += parseFloat(signal.pnl);
      totalOpenMargin += parseFloat(signal.margin);
    } else {
      const signalDate = new Date(signal.timestamp);
      const monthKey = `${signalDate.getFullYear()}-${signalDate.getMonth()}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { tp: 0, sl: 0 };
      }

      if (signal.status === 'TP') {
        tpCount++;
        monthlyStats[monthKey].tp++;
      } else if (signal.status === 'SL') {
        slCount++;
        monthlyStats[monthKey].sl++;
      }
    }
  });

  const totalClosedSignals = tpCount + slCount;
  const winRate = totalClosedSignals > 0 ? (tpCount / totalClosedSignals) * 100 : 0;
  const totalRoi = totalOpenMargin > 0 ? (totalOpenPnl / totalOpenMargin) * 100 : 0;

  const recentSignalsForDashboard = signals.slice(0, 5).map(signal => ({
    pair: signal.pair,
    type: signal.type,
    pnl: parseFloat(signal.pnl),
    status: signal.status,
    contributingWallets: signal.contributingWallets,
  }));
  
  const performanceChartData = monthNames.map((name, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index)); 
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    
    const stats = monthlyStats[monthKey] || { tp: 0, sl: 0 };
    const totalTrades = stats.tp + stats.sl;
    const monthlyWinrate = totalTrades > 0 ? (stats.tp / totalTrades) * 100 : 0;

    return {
      month: monthNames[date.getMonth()].slice(0, 3),
      winrate: parseFloat(monthlyWinrate.toFixed(1)),
    };
  }).slice(-6); // Get last 6 months


  return {
    totalPnl: totalOpenPnl,
    totalRoi,
    winRate,
    totalClosedSignals,
    activeSignals: activeSignalsCount,
    trackedWallets: trackedWallets.length,
    recentSignals: recentSignalsForDashboard,
    performanceChartData,
    signalOutcomes: {
      'Take Profit': tpCount,
      'Stop Loss': slCount,
      'Open': activeSignalsCount,
    },
  };
}
