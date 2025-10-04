import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { detectAndSaveSignals, updateSignalPrices } from '@/server/services/signals';
import { log } from '@/server/services/logs';
import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';

export async function POST() {
  const context = getCloudflareContext({ async: false });
  setCloudflareEnv(context.env as CloudflareBindings);

  const runStartedAt = Date.now();
  await log({
    level: 'INFO',
    message: 'Cloudflare worker tick started',
    context: {
      startedAt: new Date(runStartedAt).toISOString(),
    },
  });

  try {
    await detectAndSaveSignals();
    await updateSignalPrices();
    await log({
      level: 'INFO',
      message: 'Cloudflare worker tick completed',
      context: {
        durationMs: Date.now() - runStartedAt,
      },
    });
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    const err = error as Error;
    await log({
      level: 'ERROR',
      message: 'Cloudflare worker tick failed',
      context: {
        message: err.message,
        stack: err.stack,
        durationMs: Date.now() - runStartedAt,
      },
    });
    throw err;
  }
}
