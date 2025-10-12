import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const WORKER_STATE_FILE_PATH = 'worker-state.json';

export interface WorkerState {
  lastDetectionRunStartedAt: string | null;
  lastDetectionRunCompletedAt: string | null;
  lastDetectionRunDurationMs: number | null;
}

type StoredWorkerState = WorkerState & {
  nextWalletIndex?: number;
  lastDetectionRunAt?: string | null;
};

const defaultWorkerState: StoredWorkerState = {
  nextWalletIndex: 0,
  lastDetectionRunStartedAt: null,
  lastDetectionRunCompletedAt: null,
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

function deriveStartedAt(
  startedAt: string | null,
  completedAt: string | null,
  durationMs: number | null
): string | null {
  if (startedAt) {
    return startedAt;
  }

  if (!completedAt || durationMs === null || durationMs === undefined) {
    return null;
  }

  if (!Number.isFinite(durationMs)) {
    return null;
  }

  const derived = Date.parse(completedAt) - durationMs;
  if (!Number.isFinite(derived)) {
    return null;
  }

  return new Date(derived).toISOString();
}

export async function readWorkerState(): Promise<WorkerState> {
  const state = await readJsonFile<StoredWorkerState>(WORKER_STATE_FILE_PATH, defaultWorkerState);

  const lastDetectionRunCompletedAt = coerceTimestamp(
    state?.lastDetectionRunCompletedAt ?? state?.lastDetectionRunAt
  );
  const lastDetectionRunDurationMs = coerceDurationMs(state?.lastDetectionRunDurationMs);
  const lastDetectionRunStartedAt = deriveStartedAt(
    coerceTimestamp(state?.lastDetectionRunStartedAt),
    lastDetectionRunCompletedAt,
    lastDetectionRunDurationMs
  );

  return {
    lastDetectionRunStartedAt,
    lastDetectionRunCompletedAt,
    lastDetectionRunDurationMs,
  };
}

export async function writeWorkerState(state: Partial<WorkerState>): Promise<void> {
  const current = await readWorkerState();
  const merged: WorkerState = {
    lastDetectionRunStartedAt: state.lastDetectionRunStartedAt ?? current.lastDetectionRunStartedAt,
    lastDetectionRunCompletedAt:
      state.lastDetectionRunCompletedAt ?? current.lastDetectionRunCompletedAt,
    lastDetectionRunDurationMs:
      state.lastDetectionRunDurationMs ?? current.lastDetectionRunDurationMs,
  };

  await writeJsonFile(WORKER_STATE_FILE_PATH, merged);
}

