import 'dotenv/config';

import { detectAndSaveSignals, updateSignalPrices } from '../src/app/(dashboard)/signals/actions';
import { log } from '../src/app/(dashboard)/logs/actions';

const DEFAULT_DETECTION_INTERVAL_MS = 60_000;
const DEFAULT_PRICE_REFRESH_INTERVAL_MS = 30_000;

const detectionInterval = Number(process.env.DETECTION_INTERVAL_MS ?? DEFAULT_DETECTION_INTERVAL_MS);
const priceRefreshInterval = Number(process.env.PRICE_REFRESH_INTERVAL_MS ?? DEFAULT_PRICE_REFRESH_INTERVAL_MS);

let lastDetectionRun = 0;
let lastPriceRun = 0;
let running = false;

async function runCycle() {
  if (running) {
    return;
  }

  running = true;
  try {
    const now = Date.now();

    if (now - lastDetectionRun >= detectionInterval) {
      await detectAndSaveSignals();
      lastDetectionRun = now;
    }

    if (now - lastPriceRun >= priceRefreshInterval) {
      await updateSignalPrices();
      lastPriceRun = now;
    }

    await log({
      level: 'INFO',
      message: 'Background worker cycle complete',
      context: {
        detectionInterval,
        priceRefreshInterval,
        lastDetectionRun: new Date(lastDetectionRun).toISOString(),
        lastPriceRun: new Date(lastPriceRun).toISOString(),
      },
    });
  } catch (error) {
    const err = error as Error;
    await log({
      level: 'ERROR',
      message: 'Background worker cycle failed',
      context: {
        message: err.message,
        stack: err.stack,
      },
    });
  } finally {
    running = false;
  }
}

async function start() {
  await log({
    level: 'INFO',
    message: 'Starting background worker',
    context: {
      detectionInterval,
      priceRefreshInterval,
    },
  });

  // Kick off an initial run so we do not wait for the first interval tick
  await runCycle();
  setInterval(runCycle, Math.min(detectionInterval, priceRefreshInterval));
}

start().catch(async (error) => {
  const err = error as Error;
  await log({
    level: 'ERROR',
    message: 'Background worker failed to start',
    context: {
      message: err.message,
      stack: err.stack,
    },
  });
  process.exit(1);
});

process.on('SIGINT', async () => {
  await log({ level: 'WARN', message: 'Background worker received SIGINT, shutting down.' });
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await log({ level: 'WARN', message: 'Background worker received SIGTERM, shutting down.' });
  process.exit(0);
});
