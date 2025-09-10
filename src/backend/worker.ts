/*
  Background worker to run detection and price updates 24/7.
  Use PM2 to run this file: pm2 start ecosystem.config.js
*/

import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import process from 'process';

// Import existing logic from server action files (these do not depend on Next runtime)
import { detectAndSaveSignals, updateSignalPrices } from '../app/(dashboard)/signals/actions';
import { getSettings } from '../app/(dashboard)/settings/actions';
import { log } from '../app/(dashboard)/logs/actions';

async function main() {
  // Ensure CWD is project root (so JSON paths resolve correctly)
  const projectRoot = path.resolve(__dirname, '../..', '..');
  process.chdir(projectRoot);

  await log({ level: 'INFO', message: 'Background worker starting...' });

  // Load settings initially and then re-load periodically
  let walletPollMs = 60_000; // default 60s
  let pricePollMs = 30_000;  // default 30s

  async function refreshIntervalsFromSettings() {
    try {
      const settings = await getSettings();
      walletPollMs = Math.max(10_000, (settings.walletPollInterval || 60) * 1000);
      pricePollMs = Math.max(5_000, (settings.pricePollInterval || 30) * 1000);
      await log({ level: 'INFO', message: `Worker intervals set: detect=${walletPollMs}ms, price=${pricePollMs}ms` });
    } catch (e: any) {
      await log({ level: 'WARN', message: 'Failed to load settings; using defaults', context: { error: e?.message } });
    }
  }

  await refreshIntervalsFromSettings();

  // Stagger loops to avoid synchronized calls
  let lastDetect = 0;
  let lastPrice = 0;

  while (true) {
    const now = Date.now();

    // Periodic re-read of settings every 5 minutes
    if (now % (5 * 60_000) < 1000) {
      await refreshIntervalsFromSettings();
    }

    // Detection loop
    if (now - lastDetect >= walletPollMs) {
      lastDetect = now;
      try {
        await detectAndSaveSignals();
      } catch (e: any) {
        await log({ level: 'ERROR', message: 'detectAndSaveSignals failed', context: { error: e?.message } });
      }
    }

    // Price update loop
    if (now - lastPrice >= pricePollMs) {
      lastPrice = now;
      try {
        await updateSignalPrices();
      } catch (e: any) {
        await log({ level: 'ERROR', message: 'updateSignalPrices failed', context: { error: e?.message } });
      }
    }

    // Sleep a bit to avoid tight loop
    await sleep(1000);
  }
}

main().catch(async (e) => {
  try {
    await log({ level: 'ERROR', message: 'Worker crashed on startup', context: { error: e?.message } });
  } catch {}
  process.exit(1);
});
