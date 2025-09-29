'use server';

import type { Signal } from '@/server/services/signals';
import {
  deleteSignal as deleteSignalService,
  detectAndSaveSignals as detectAndSaveSignalsService,
  getSignals as getSignalsService,
  updateSignalPrices as updateSignalPricesService,
} from '@/server/services/signals';

export type { Signal };

export async function detectAndSaveSignals(): Promise<void> {
  await detectAndSaveSignalsService();
}

export async function getSignals(): Promise<Signal[]> {
  return getSignalsService();
}

export async function deleteSignal(signalId: string): Promise<void> {
  await deleteSignalService(signalId);
}

export async function updateSignalPrices(): Promise<Signal[]> {
  return updateSignalPricesService();
}
