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
    const automationSchedulerCode = `\n\nconst DEFAULT_AUTOMATION_INTERVAL_MS = 5 * 60 * 1000;\n\nasync function runAutomationTickFromScheduler(reason) {\n  const basePathValue = globalThis.__NEXT_BASE_PATH__ ?? '';\n  const basePath = basePathValue.endsWith('/') ? basePathValue.slice(0, -1) : basePathValue;\n  const pathname = basePath ? basePath + '/api/automation/run' : '/api/automation/run';\n  const url = new URL(pathname, 'https://automation.scheduler');\n  const request = new Request(url, {\n    method: 'POST',\n    headers: {\n      'cf-automation-trigger': reason,\n    },\n  });\n\n  const response = await fetch(request);\n  if (!response.ok) {\n    const errorBody = await response.text();\n    console.error('Automation scheduler request failed', response.status, response.statusText, errorBody);\n    throw new Error(\`Automation scheduler request failed with status \${response.status}\`);\n  }\n\n  return response;\n}\n\nexport class AutomationScheduler {\n  constructor(state, env) {\n    this.state = state;\n    this.env = env;\n    this.intervalMs = Math.max(\n      60_000,\n      Number(env.AUTOMATION_TICK_INTERVAL_MS ?? DEFAULT_AUTOMATION_INTERVAL_MS)\n    );\n\n    state.blockConcurrencyWhile(async () => {\n      const nextAlarm = await state.storage.get('nextAlarm');\n      if (typeof nextAlarm === 'number') {\n        await state.setAlarm(nextAlarm);\n      } else {\n        await this.scheduleNext(Date.now());\n      }\n    });\n  }\n\n  async fetch(request) {\n    const url = new URL(request.url);\n\n    if (request.method === 'POST' && url.pathname === '/bootstrap') {\n      const now = Date.now();\n      const nextAlarm = await this.state.storage.get('nextAlarm');\n\n      if (typeof nextAlarm !== 'number' || nextAlarm <= now) {\n        const scheduled = await this.scheduleNext(now);\n        return new Response(JSON.stringify({ nextAlarm: scheduled }), {\n          headers: { 'content-type': 'application/json' },\n        });\n      }\n\n      await this.state.setAlarm(nextAlarm);\n      return new Response(JSON.stringify({ nextAlarm }), {\n        headers: { 'content-type': 'application/json' },\n      });\n    }\n\n    if (request.method === 'POST' && url.pathname === '/trigger') {\n      await this.runAutomation('manual-trigger');\n      const scheduled = await this.scheduleNext(Date.now());\n      return new Response(JSON.stringify({ nextAlarm: scheduled }), {\n        headers: { 'content-type': 'application/json' },\n      });\n    }\n\n    return new Response('Not Found', { status: 404 });\n  }\n\n  async alarm(alarmTime) {\n    try {\n      await this.runAutomation('alarm');\n    } finally {\n      await this.scheduleNext(typeof alarmTime === 'number' ? alarmTime : Date.now());\n    }\n  }\n\n  async runAutomation(reason) {\n    try {\n      await runAutomationTickFromScheduler(reason);\n    } catch (error) {\n      console.error('Automation scheduler run failed', error);\n      throw error;\n    }\n  }\n\n  async scheduleNext(referenceTime) {\n    const next = Math.max(referenceTime, Date.now()) + this.intervalMs;\n    await this.state.storage.put('nextAlarm', next);\n    await this.state.setAlarm(next);\n    return next;\n  }\n}\n`;

    source = `${source}${automationSchedulerCode}`;
  }

  await writeFile(workerPath, source);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
