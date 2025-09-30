'use server';

import type { DashboardData } from '@/server/services/dashboard';
import { getDashboardData as getDashboardDataService } from '@/server/services/dashboard';

export type { DashboardData };

export async function getDashboardData(): Promise<DashboardData> {
  return getDashboardDataService();
}
