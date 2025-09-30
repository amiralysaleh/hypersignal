import { getSignals } from './signals';

export interface WalletPerformance {
  rank: number;
  address: string;
  successRate: number;
  pnl: number;
  trades: number;
}

function resolveTimeframe(timeframe: string): number | null {
  const now = Date.now();
  switch (timeframe) {
    case '24h':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'all':
    default:
      return null;
  }
}

export async function getPerformanceData(timeframe: string): Promise<WalletPerformance[]> {
  const signals = await getSignals();
  const cutoff = resolveTimeframe(timeframe);
  const walletStats = new Map<string, { pnl: number; trades: number; wins: number }>();

  signals
    .filter((signal) => signal.status !== 'Open')
    .filter((signal) => {
      if (!cutoff) {
        return true;
      }
      return new Date(signal.timestamp).getTime() >= cutoff;
    })
    .forEach((signal) => {
      const pnl = parseFloat(signal.pnl);
      const isWin = signal.status === 'TP';

      const totalSignalSize = signal.clusterFills
        ? signal.clusterFills.reduce((acc: number, fill: any) => acc + Math.abs(parseFloat(fill.sz)), 0)
        : signal.contributingWalletAddresses.length;

      if (totalSignalSize <= 0) {
        const share = pnl / signal.contributingWalletAddresses.length;
        signal.contributingWalletAddresses.forEach((address) => {
          const stats = walletStats.get(address) ?? { pnl: 0, trades: 0, wins: 0 };
          stats.pnl += share;
          stats.trades += 1;
          if (isWin) {
            stats.wins += 1;
          }
          walletStats.set(address, stats);
        });
        return;
      }

      if (signal.clusterFills) {
        signal.clusterFills.forEach((fill: any) => {
          const fillSize = Math.abs(parseFloat(fill.sz));
          if (fillSize <= 0) {
            return;
          }
          const share = pnl * (fillSize / totalSignalSize);
          const stats = walletStats.get(fill.walletAddress) ?? { pnl: 0, trades: 0, wins: 0 };
          stats.pnl += share;
          stats.trades += 1;
          if (isWin) {
            stats.wins += 1;
          }
          walletStats.set(fill.walletAddress, stats);
        });
      } else {
        signal.contributingWalletAddresses.forEach((address) => {
          const share = pnl / signal.contributingWalletAddresses.length;
          const stats = walletStats.get(address) ?? { pnl: 0, trades: 0, wins: 0 };
          stats.pnl += share;
          stats.trades += 1;
          if (isWin) {
            stats.wins += 1;
          }
          walletStats.set(address, stats);
        });
      }
    });

  const performances: WalletPerformance[] = Array.from(walletStats.entries())
    .map(([address, stats]) => ({
      address,
      pnl: stats.pnl,
      trades: stats.trades,
      successRate: stats.trades > 0 ? parseFloat(((stats.wins / stats.trades) * 100).toFixed(2)) : 0,
      rank: 0,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return performances;
}
