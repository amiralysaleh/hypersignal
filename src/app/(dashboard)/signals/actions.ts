'use server';

import { detectAndSaveSignals, getSignals as fetchSignals, deleteSignal as removeSignal, updateSignalPrices as refreshSignalPrices } from '@/backend/signal-service';
import { Signal } from '@/types/signal';

export type { Signal } from '@/types/signal';

export async function getSignals(): Promise<Signal[]> {
  return fetchSignals();
}

export async function detectAndSaveSignalsAction(): Promise<boolean> {
  return detectAndSaveSignals();
}

export async function updateSignalPrices(): Promise<Signal[]> {
  return refreshSignalPrices();
}

export async function deleteSignal(signalId: string): Promise<void> {
  return removeSignal(signalId);
}

export { detectAndSaveSignalsAction as detectAndSaveSignals };
