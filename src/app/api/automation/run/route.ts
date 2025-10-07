import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { detectAndSaveSignals, updateSignalPrices } from '@/server/services/signals';
import { log } from '@/server/services/logs';
import {
  completeWorkerRun,
  markStaleWorkerRuns,
  registerWorkerRun,
  touchWorkerRun,
} from '@/server/services/workerRuns';
import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';

export async function POST() {
  const context = getCloudflareContext({ async: false });
  setCloudflareEnv(context.env as CloudflareBindings);

  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const startedAt = Date.now();
  let status: 'success' | 'error' = 'success';

  const staleRuns = await markStaleWorkerRuns({
    now: startedAt,
    staleAfterMs: 10 * 60 * 1000,
  });

  for (const staleRun of staleRuns) {
    await log({
      level: 'ERROR',
      message: 'Cloudflare worker tick inferred timeout',
      context: {
        runId: staleRun.runId,
        startedAt: staleRun.startedAt,
        lastUpdate: staleRun.updatedAt,
      },
    });
  }

  await registerWorkerRun({ runId, startedAt });
  await log({ level: 'INFO', message: 'Cloudflare worker tick started', context: { runId } });

  try {
    const createHeartbeat = () => {
      let lastBeat = 0;
      return async (progress?: { durationMs?: number }) => {
        const now = Date.now();
        if (now - lastBeat < 5000 && !(progress?.durationMs && progress.durationMs >= 60000)) {
          return;
        }

        lastBeat = now;
        await touchWorkerRun({ runId, durationMs: progress?.durationMs });
      };
    };

    const heartbeat = createHeartbeat();

    await log({ level: 'INFO', message: 'Detecting new signals', context: { runId } });
    await detectAndSaveSignals({
      onProgress: async ({ durationMs }) => {
        await heartbeat({ durationMs });
      },
    });
    await heartbeat({ durationMs: Date.now() - startedAt });
    await log({ level: 'INFO', message: 'Updating signal prices', context: { runId } });
    await heartbeat({ durationMs: Date.now() - startedAt });
    await updateSignalPrices();
    await heartbeat({ durationMs: Date.now() - startedAt });
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    const err = error as Error;
    status = 'error';
    await log({
      level: 'ERROR',
      message: 'Cloudflare worker tick failed',
      context: {
        runId,
        message: err.message,
        stack: err.stack,
      },
    });
    throw err;
  } finally {
    const durationMs = Date.now() - startedAt;
    await completeWorkerRun({ runId, status, durationMs });
    await log({
      level: 'INFO',
      message: status === 'success' ? 'Cloudflare worker tick completed' : 'Cloudflare worker tick ended with errors',
      context: {
        runId,
        status,
        durationMs,
      },
    });
  }
}
