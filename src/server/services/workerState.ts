import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const WORKER_STATE_FILE_PATH = 'worker-state.json';

export interface WorkerState {
  lastDetectionRunAt: string | null;
  lastDetectionRunDurationMs: number | null;
}

type StoredWorkerState = WorkerState & { nextWalletIndex?: number };

const defaultWorkerState: StoredWorkerState = {
  nextWalletIndex: 0,
  lastDetectionRunAt: null,
  lastDetectionRunDurationMs: null,
};

function coerceTimestamp(timestamp: unknown): string | null {
  if (typeof timestamp === 'string' && timestamp.trim()) {
    const parsed = Date.parse(timestamp);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  return null;
}

function coerceDurationMs(duration: unknown): number | null {
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return duration;
  }

  if (typeof duration === 'string' && duration.trim()) {
    const parsed = Number(duration);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function readWorkerState(): Promise<WorkerState> {
  const state = await readJsonFile<StoredWorkerState>(WORKER_STATE_FILE_PATH, defaultWorkerState);

  return {
    lastDetectionRunAt: coerceTimestamp(state?.lastDetectionRunAt),
    lastDetectionRunDurationMs: coerceDurationMs(state?.lastDetectionRunDurationMs),
  };
}

export async function writeWorkerState(state: Partial<WorkerState>): Promise<void> {
  const current = await readWorkerState();
  const merged: WorkerState = {
    lastDetectionRunAt: state.lastDetectionRunAt ?? current.lastDetectionRunAt,
    lastDetectionRunDurationMs:
      state.lastDetectionRunDurationMs ?? current.lastDetectionRunDurationMs,
  };

  await writeJsonFile(WORKER_STATE_FILE_PATH, merged);
}

