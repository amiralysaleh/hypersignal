import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const workerPath = resolve('.open-next/worker.js');

  let source;
  try {
    source = await readFile(workerPath, 'utf8');
  } catch (error) {
    console.error('Unable to find OpenNext worker at %s', workerPath);
    throw error;
  }

  const marker = '    async scheduled(event, env, ctx) {';
  if (source.includes(marker)) {
    source = source.replace(/\n\s+async scheduled\([\s\S]*?\n\s*},\n/, '\n');
  }

  if (!source.includes('class AutomationScheduler')) {
    const automationSchedulerCode = String.raw`

const DEFAULT_AUTOMATION_INTERVAL_MS = 5 * 60 * 1000;

async function runAutomationTickFromScheduler(reason, env, origin) {
  const automationTickHandler = globalThis.__HYPERSIGNAL_AUTOMATION_TICK__;
  if (typeof automationTickHandler === 'function') {
    const response = await automationTickHandler({ env, reason });
    if (response instanceof Response) {
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Automation scheduler request failed', response.status, response.statusText, errorBody);
        throw new Error('Automation scheduler request failed with status ' + response.status);
      }
      return response;
    }
    return response;
  }

  const basePathValue = globalThis.__NEXT_BASE_PATH__ ?? '';
  const basePath = basePathValue.endsWith('/') ? basePathValue.slice(0, -1) : basePathValue;
  const pathname = basePath ? basePath + '/api/automation/run' : '/api/automation/run';
  const targetOrigin = typeof origin === 'string' && origin ? origin : 'https://automation.scheduler';
  const url = new URL(pathname, targetOrigin);
  const request = new Request(url, {
    method: 'POST',
    headers: {
      'cf-automation-trigger': reason,
    },
  });

  const response = await fetch(request);
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Automation scheduler request failed', response.status, response.statusText, errorBody);
    throw new Error('Automation scheduler request failed with status ' + response.status);
  }

  return response;
}

export class AutomationScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.intervalMs = Math.max(
      60_000,
      Number(env.AUTOMATION_TICK_INTERVAL_MS ?? DEFAULT_AUTOMATION_INTERVAL_MS)
    );
    this.workerOrigin = null;

    state.blockConcurrencyWhile(async () => {
      const [nextAlarm, storedOrigin] = await Promise.all([
        state.storage.get('nextAlarm'),
        state.storage.get('workerOrigin'),
      ]);
      if (typeof storedOrigin === 'string' && storedOrigin) {
        this.workerOrigin = storedOrigin;
      }
      if (typeof nextAlarm === 'number') {
        await state.storage.setAlarm(nextAlarm);
      } else {
        await this.scheduleNext(Date.now());
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/bootstrap') {
      const now = Date.now();
      const originHeader = request.headers.get('cf-worker-origin');
      if (originHeader) {
        this.workerOrigin = originHeader;
        await this.state.storage.put('workerOrigin', originHeader);
      }
      const nextAlarm = await this.state.storage.get('nextAlarm');

      if (typeof nextAlarm !== 'number' || nextAlarm <= now) {
        const scheduled = await this.scheduleNext(now);
        return new Response(JSON.stringify({ nextAlarm: scheduled, workerOrigin: this.workerOrigin ?? null }), {
          headers: { 'content-type': 'application/json' },
        });
      }

      await this.state.storage.setAlarm(nextAlarm);
      return new Response(JSON.stringify({ nextAlarm, workerOrigin: this.workerOrigin ?? null }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/trigger') {
      await this.runAutomation('manual-trigger');
      const scheduled = await this.scheduleNext(Date.now());
      return new Response(JSON.stringify({ nextAlarm: scheduled, workerOrigin: this.workerOrigin ?? null }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  async alarm(alarmTime) {
    try {
      await this.runAutomation('alarm');
    } finally {
      await this.scheduleNext(typeof alarmTime === 'number' ? alarmTime : Date.now());
    }
  }

  async runAutomation(reason) {
    try {
      await runAutomationTickFromScheduler(reason, this.env, this.workerOrigin);
    } catch (error) {
      console.error('Automation scheduler run failed', error);
      throw error;
    }
  }

  async scheduleNext(referenceTime) {
    const next = Math.max(referenceTime, Date.now()) + this.intervalMs;
    await this.state.storage.put('nextAlarm', next);
    await this.state.storage.setAlarm(next);
    return next;
  }
}
`;

    source = `${source}${automationSchedulerCode}`;
  }

  await writeFile(workerPath, source);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
