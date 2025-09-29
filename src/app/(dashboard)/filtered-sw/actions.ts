'use server';

import type {
  CorrelationGroup,
  SuccessPredictionOutput,
  WalletCorrelationsOutput,
} from '@/server/services/analytics';
import {
  getWalletCorrelations as getWalletCorrelationsService,
  predictSignalSuccess as predictSignalSuccessService,
} from '@/server/services/analytics';

export type { SuccessPredictionOutput, CorrelationGroup, WalletCorrelationsOutput };

export async function predictSignalSuccess(): Promise<SuccessPredictionOutput> {
  return predictSignalSuccessService();
}

export async function getWalletCorrelations(): Promise<WalletCorrelationsOutput> {
  return getWalletCorrelationsService();
}
