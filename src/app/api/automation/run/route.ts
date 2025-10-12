import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { detectAndSaveSignals, updateSignalPrices } from '@/server/services/signals';
import { log } from '@/server/services/logs';
import {
  completeWorkerRun,
  findActiveWorkerRun,
  markStaleWorkerRuns,
  registerWorkerRun,
  touchWorkerRun,
} from '@/server/services/workerRuns';
import { readWorkerState } from '@/server/services/workerState';
import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';

const AUTOMATION_TICK_TIME_LIMIT_MS = Math.max(
  120_000,
  Number(process.env.AUTOMATION_TICK_TIME_LIMIT_MS ?? 8 * 60_000)
);
const AUTOMATION_TICK_COMPLETION_BUFFER_MS = Math.max(
  15_000,
  Number(process.env.AUTOMATION_TICK_COMPLETION_BUFFER_MS ?? 30_000)
);
const AUTOMATION_ACTIVE_RUN_GRACE_MS = Math.max(
  15_000,
  Number(process.env.AUTOMATION_ACTIVE_RUN_GRACE_MS ?? 12 * 60_000)
);
const AUTOMATION_MIN_INTERVAL_MS = Math.max(
  5 * 60_000,
  Number(process.env.AUTOMATION_MIN_INTERVAL_MS ?? 10 * 60_000)
);

export async function POST() {
  const context = getCloudflareContext({ async: false });
  setCloudflareEnv(context.env as CloudflareBindings);

  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const startedAt = Date.now();
  const automationDeadline = startedAt + AUTOMATION_TICK_TIME_LIMIT_MS;
  let status: 'success' | 'error' = 'success';

  const workerState = await readWorkerState();
  const lastDetectionRunAt = workerState.lastDetectionRunAt
    ? Date.parse(workerState.lastDetectionRunAt)
    : NaN;
  const lastDetectionRunDuration = Number(workerState.lastDetectionRunDurationMs);
  const lastDetectionRunStartedAt = Number.isFinite(lastDetectionRunAt) &&
    Number.isFinite(lastDetectionRunDuration)
      ? lastDetectionRunAt - Math.max(0, lastDetectionRunDuration)
      : NaN;

  const referenceTimestamp = Number.isFinite(lastDetectionRunStartedAt)
    ? lastDetectionRunStartedAt
    : lastDetectionRunAt;

  if (Number.isFinite(referenceTimestamp)) {
    const sinceLastRunMs = startedAt - referenceTimestamp;
    if (sinceLastRunMs < AUTOMATION_MIN_INTERVAL_MS) {
      const cooldownRemainingMs = AUTOMATION_MIN_INTERVAL_MS - sinceLastRunMs;
      await log({
        level: 'INFO',
        message: 'Cloudflare worker tick skipped due to cooldown window.',
        context: {
          runId,
          startedAt,
          lastDetectionRunAt: workerState.lastDetectionRunAt,
          lastDetectionRunDurationMs: workerState.lastDetectionRunDurationMs,
          cooldownRemainingMs,
          minIntervalMs: AUTOMATION_MIN_INTERVAL_MS,
        },
      });

      return NextResponse.json(
        {
          status: 'skipped',
          reason: 'cooldown',
          cooldownRemainingMs,
        },
        { status: 202 }
      );
    }
  }

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

  const activeRun = await findActiveWorkerRun({
    now: startedAt,
    activityGraceMs: AUTOMATION_ACTIVE_RUN_GRACE_MS,
  });

  if (activeRun) {
    await log({
      level: 'WARN',
      message: 'Cloudflare worker tick skipped because another run is active.',
      context: {
        runId,
        activeRunId: activeRun.runId,
        activeRunStartedAt: activeRun.startedAt,
        activeRunUpdatedAt: activeRun.updatedAt,
      },
    });

    return NextResponse.json(
      {
        status: 'skipped',
        reason: 'active-run',
        activeRunId: activeRun.runId,
      },
      { status: 202 }
    );
  }

  await registerWorkerRun({ runId, startedAt });
  await log({ level: 'INFO', message: 'Cloudflare worker tick started', context: { runId } });

  try {
    const createHeartbeat = () => {
      let lastBeat = 0;
      return async (progress?: { durationMs?: number }) => {
        const now = Date.now();
        if (now - lastBeat < 2000 && !(progress?.durationMs && progress.durationMs >= 60_000)) {
          return;
        }

        lastBeat = now;
        await touchWorkerRun({ runId, durationMs: progress?.durationMs });
      };
    };

    const heartbeat = createHeartbeat();
    const durationSinceStart = () => Date.now() - startedAt;
    const timeRemaining = () => automationDeadline - Date.now();
    const detectionDeadline = Math.max(
      startedAt + 60_000,
      Math.min(automationDeadline - AUTOMATION_TICK_COMPLETION_BUFFER_MS, automationDeadline)
    );

    await log({ level: 'INFO', message: 'Detecting new signals', context: { runId } });
    await detectAndSaveSignals({
      deadlineMs: detectionDeadline,
      onProgress: async ({ durationMs }) => {
        await heartbeat({ durationMs });
      },
    });
    await heartbeat({ durationMs: durationSinceStart() });

    if (timeRemaining() <= AUTOMATION_TICK_COMPLETION_BUFFER_MS) {
      await log({
        level: 'WARN',
        message: 'Skipping signal price update due to automation time limit proximity.',
        context: {
          runId,
          durationMs: durationSinceStart(),
          timeRemainingMs: timeRemaining(),
          completionBufferMs: AUTOMATION_TICK_COMPLETION_BUFFER_MS,
        },
      });
      return NextResponse.json({ status: 'partial', skipped: 'price-update' });
    }

    await log({ level: 'INFO', message: 'Updating signal prices', context: { runId } });
    await heartbeat({ durationMs: durationSinceStart() });
    await updateSignalPrices({
      deadlineMs: automationDeadline,
      onProgress: async (progress) => {
        await heartbeat({ durationMs: progress.durationMs });
        if (progress.stage === 'complete' && progress.skipped) {
          await log({
            level: 'WARN',
            message: 'Signal price update ended early due to automation deadline.',
            context: {
              runId,
              durationMs: progress.durationMs,
              timeRemainingMs: timeRemaining(),
              deadlineMs: AUTOMATION_TICK_TIME_LIMIT_MS,
              coinsProcessed: progress.index !== undefined ? progress.index + 1 : undefined,
              totalCoins: progress.total,
            },
          });
        }
      },
    });
    await heartbeat({ durationMs: durationSinceStart() });
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
