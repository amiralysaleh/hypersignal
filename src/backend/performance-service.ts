import { getTrackedAddresses } from './wallet-service';
import type { WalletPerformance } from '@/types/performance';

export async function getPerformanceData(timeframe: string): Promise<WalletPerformance[]> {
  const addresses = await getTrackedAddresses();
  const data = addresses.map((address) => ({
    address: `${address.slice(0, 6)}...${address.slice(-4)}`,
    successRate: parseFloat((Math.random() * 60 + 40).toFixed(2)),
    pnl: parseFloat((Math.random() * 10000 - 2000).toFixed(2)),
    trades: Math.floor(Math.random() * 200 + 10),
  }));

  const sortedData = data.sort((a, b) => b.pnl - a.pnl);
  return sortedData.map((item, index) => ({ ...item, rank: index + 1 }));
}
