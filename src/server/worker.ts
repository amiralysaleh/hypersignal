import 'dotenv/config';
import { detectAndSaveSignals, updateSignalPrices } from '@/backend/signal-service';
import { getSettings } from '@/backend/settings-service';
import { log } from '@/backend/log-service';

const MIN_INTERVAL_SECONDS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function detectionLoop() {
  while (true) {
    const settings = await getSettings();
    const interval = Math.max(settings.walletPollInterval || MIN_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS) * 1000;
    try {
      const newSignals = await detectAndSaveSignals();
      if (newSignals) {
        await log({ level: 'INFO', message: 'Background worker detected new signals.' });
      }
    } catch (error: any) {
      await log({ level: 'ERROR', message: 'Background worker failed to detect signals', context: { error: error?.message } });
    }
    await sleep(interval);
  }
}

async function priceLoop() {
  while (true) {
    const settings = await getSettings();
    const interval = Math.max(settings.pricePollInterval || MIN_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS) * 1000;
    try {
      await updateSignalPrices();
    } catch (error: any) {
      await log({ level: 'ERROR', message: 'Background worker failed to update prices', context: { error: error?.message } });
    }
    await sleep(interval);
  }
}

async function main() {
  await log({ level: 'INFO', message: 'Background worker started.' });
  await Promise.all([detectionLoop(), priceLoop()]);
}

main().catch(async (error) => {
  console.error('Worker exited with error', error);
  await log({ level: 'ERROR', message: 'Background worker crashed', context: { error: error?.message } });
  process.exit(1);
});
