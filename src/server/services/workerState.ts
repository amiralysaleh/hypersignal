import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const WORKER_STATE_FILE_PATH = 'worker-state.json';

export interface WorkerState {
  nextWalletIndex: number;
  lastDetectionRunAt: string | null;
  lastDetectionRunDurationMs: number | null;
}

const defaultWorkerState: WorkerState = {
  nextWalletIndex: 0,
  lastDetectionRunAt: null,
  lastDetectionRunDurationMs: null,
};

function normalizeIndex(index: unknown, totalWallets?: number): number {
  const parsed = typeof index === 'number' ? index : Number(index ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  if (typeof totalWallets === 'number' && totalWallets > 0) {
    return parsed % totalWallets;
  }

  return Math.floor(parsed);
}

export async function readWorkerState(): Promise<WorkerState> {
  const state = await readJsonFile(WORKER_STATE_FILE_PATH, defaultWorkerState);
  return {
    nextWalletIndex: normalizeIndex(state?.nextWalletIndex),
    lastDetectionRunAt: state?.lastDetectionRunAt ?? null,
    lastDetectionRunDurationMs: Number.isFinite(state?.lastDetectionRunDurationMs)
      ? Number(state.lastDetectionRunDurationMs)
      : null,
  };
}

export async function writeWorkerState(state: Partial<WorkerState>): Promise<void> {
  const current = await readWorkerState();
  const merged: WorkerState = {
    nextWalletIndex: normalizeIndex(state.nextWalletIndex ?? current.nextWalletIndex),
    lastDetectionRunAt: state.lastDetectionRunAt ?? current.lastDetectionRunAt,
    lastDetectionRunDurationMs:
      state.lastDetectionRunDurationMs ?? current.lastDetectionRunDurationMs,
  };

  await writeJsonFile(WORKER_STATE_FILE_PATH, merged);
}

