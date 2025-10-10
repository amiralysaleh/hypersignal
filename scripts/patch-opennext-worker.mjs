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

  const insertion = String.raw`\n    async scheduled(event, env, ctx) {\n      const basePathValue = globalThis.__NEXT_BASE_PATH__ ?? '';\n      const basePath = basePathValue.endsWith('/') ? basePathValue.slice(0, -1) : basePathValue;\n      const pathname = basePath ? basePath + '/api/automation/run' : '/api/automation/run';\n      const url = new URL(pathname, 'https://scheduled.internal');\n      const request = new Request(url, {\n        method: 'POST',\n        headers: {\n          'cf-scheduled': '1',\n          'cf-cron': event.cron ?? '',\n        },\n      });\n\n      const waitUntil = ctx?.waitUntil ?? event.waitUntil?.bind(event);\n      if (!waitUntil) {\n        throw new Error('Unable to schedule background work: missing waitUntil on context or event');\n      }\n\n      waitUntil(\n        runWithCloudflareRequestContext(request, env, ctx, async () => {\n          const { handler } = await import('./server-functions/default/handler.mjs');\n          await handler(request, env, ctx, request.signal);\n        }),\n      );\n    },\n`;

  const closingIndex = source.lastIndexOf('\n};');
  if (closingIndex === -1) {
    throw new Error('Unable to locate export default block in worker.js');
  }

  const updated = `${source.slice(0, closingIndex)}${insertion}\n};${source.slice(closingIndex + 3)}`;
  await writeFile(workerPath, updated);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
