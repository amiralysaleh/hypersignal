import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { detectAndSaveSignals, updateSignalPrices } from '@/server/services/signals';
import { log } from '@/server/services/logs';
import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';

export async function POST() {
  const context = getCloudflareContext({ async: false });
  if (!context?.env) {
    throw new Error('Cloudflare bindings are not available in this environment.');
  }

  setCloudflareEnv(context.env as CloudflareBindings);

  await log({ level: 'INFO', message: 'Cloudflare worker tick started' });

  try {
    await detectAndSaveSignals();
    await updateSignalPrices();
    await log({ level: 'INFO', message: 'Cloudflare worker tick completed' });
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    const err = error as Error;
    await log({
      level: 'ERROR',
      message: 'Cloudflare worker tick failed',
      context: {
        message: err.message,
        stack: err.stack,
      },
    });
    throw err;
  }
}
