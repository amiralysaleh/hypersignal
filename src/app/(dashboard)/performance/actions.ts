'use server';

import type { WalletPerformance } from '@/server/services/performance';
import { getPerformanceData as getPerformanceDataService } from '@/server/services/performance';

export type { WalletPerformance };

export async function getPerformanceData(timeframe: string): Promise<WalletPerformance[]> {
  return getPerformanceDataService(timeframe);
}
