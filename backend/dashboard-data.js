const { getSignals } = require('./signal-worker');
const fs = require('fs').promises;
const path = require('path');

const WALLETS_FILE_PATH = path.resolve(process.cwd(), 'wallets.json');

async function readWallets() {
  try {
    await fs.access(WALLETS_FILE_PATH);
    const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(WALLETS_FILE_PATH, JSON.stringify([]));
      return [];
    }
    throw error;
  }
}

async function getTrackedAddresses() {
  const wallets = await readWallets();
  return wallets.filter(wallet => wallet.isActive);
}

async function getDashboardData() {
  const trackedWallets = await getTrackedAddresses();
  const signals = await getSignals();

  let totalOpenPnl = 0;
  let totalOpenMargin = 0;
  let activeSignalsCount = 0;
  let tpCount = 0;
  let slCount = 0;
  const monthlyStats = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  
  const performanceChartData = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const stats = monthlyStats[monthKey] || { tp: 0, sl: 0 };
    const totalTrades = stats.tp + stats.sl;
    const monthlyWinrate = totalTrades > 0 ? (stats.tp / totalTrades) * 100 : 0;
    performanceChartData.push({
      month: monthNames[d.getMonth()],
      winrate: parseFloat(monthlyWinrate.toFixed(1)),
    });
  }

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

module.exports = {
  getDashboardData,
  getTrackedAddresses
};