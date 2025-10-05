import { readJsonFile, writeJsonFile } from '../storage/jsonStore';

const WORKER_RUNS_FILE_PATH = 'worker-runs.json';
const defaultRuns: WorkerRunRecord[] = [];
const MAX_WORKER_RUN_RECORDS = 100;

export type WorkerRunStatus = 'running' | 'success' | 'error' | 'timeout';

export interface WorkerRunRecord {
  runId: string;
  status: WorkerRunStatus;
  startedAt: string;
  updatedAt: string;
  durationMs?: number;
}

async function readWorkerRuns(): Promise<WorkerRunRecord[]> {
  const runs = await readJsonFile(WORKER_RUNS_FILE_PATH, defaultRuns);
  return Array.isArray(runs) ? runs : defaultRuns;
}

async function writeWorkerRuns(runs: WorkerRunRecord[]): Promise<void> {
  await writeJsonFile(WORKER_RUNS_FILE_PATH, runs.slice(0, MAX_WORKER_RUN_RECORDS));
}

interface MarkStaleWorkerRunsOptions {
  now: number;
  staleAfterMs: number;
}

export async function markStaleWorkerRuns({
  now,
  staleAfterMs,
}: MarkStaleWorkerRunsOptions): Promise<WorkerRunRecord[]> {
  const runs = await readWorkerRuns();
  if (runs.length === 0) {
    return [];
  }

  const nowIso = new Date(now).toISOString();
  const staleThreshold = now - staleAfterMs;
  const staleRuns: WorkerRunRecord[] = [];

  const updatedRuns = runs.map((run) => {
    if (run.status !== 'running') {
      return run;
    }

    const startedTime = Date.parse(run.startedAt);
    if (!Number.isFinite(startedTime) || startedTime >= staleThreshold) {
      return run;
    }

    const timedOutRun: WorkerRunRecord = {
      ...run,
      status: 'timeout',
      updatedAt: nowIso,
    };

    staleRuns.push(timedOutRun);
    return timedOutRun;
  });

  if (staleRuns.length > 0) {
    await writeWorkerRuns(updatedRuns);
  }

  return staleRuns;
}

interface RegisterWorkerRunOptions {
  runId: string;
  startedAt: number;
}

export async function registerWorkerRun({ runId, startedAt }: RegisterWorkerRunOptions): Promise<void> {
  const runs = await readWorkerRuns();
  const startedIso = new Date(startedAt).toISOString();
  const updatedRuns: WorkerRunRecord[] = [
    {
      runId,
      status: 'running',
      startedAt: startedIso,
      updatedAt: startedIso,
    },
    ...runs.filter((run) => run.runId !== runId),
  ];

  await writeWorkerRuns(updatedRuns);
}

interface CompleteWorkerRunOptions {
  runId: string;
  status: 'success' | 'error';
  durationMs: number;
}

export async function completeWorkerRun({
  runId,
  status,
  durationMs,
}: CompleteWorkerRunOptions): Promise<void> {
  const runs = await readWorkerRuns();
  const updatedIso = new Date(Date.now()).toISOString();

  let runFound = false;
  const updatedRuns = runs.map((run) => {
    if (run.runId !== runId) {
      return run;
    }

    const completedRun: WorkerRunRecord = {
      ...run,
      status,
      durationMs,
      updatedAt: updatedIso,
    };

    runFound = true;
    return completedRun;
  });

  if (!runFound) {
    updatedRuns.unshift({
      runId,
      status,
      startedAt: updatedIso,
      updatedAt: updatedIso,
      durationMs,
    });
  }

  await writeWorkerRuns(updatedRuns);
}
