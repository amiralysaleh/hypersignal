import { detectAndSaveSignals, updateSignalPrices } from '../src/server/services/signals';
import { log } from '../src/server/services/logs';
import { setCloudflareEnv } from '../src/server/storage/env';

interface Env extends CloudflareBindings {}

export default {
  async fetch(request: Request, env: Env) {
    setCloudflareEnv(env);

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/run') {
      return new Response('Not Found', { status: 404 });
    }

    await runAutomation(env);
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    setCloudflareEnv(env);
    ctx.waitUntil(runAutomation(env));
  },
};

async function runAutomation(env: Env) {
  await log({ level: 'INFO', message: 'Cloudflare worker tick started' });

  try {
    await detectAndSaveSignals();
    await updateSignalPrices();
    await log({ level: 'INFO', message: 'Cloudflare worker tick completed' });
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
