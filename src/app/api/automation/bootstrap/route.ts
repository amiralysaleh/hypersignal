import { NextResponse } from 'next/server';

import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';
import { log } from '@/server/services/logs';

async function resolveCloudflareEnv(): Promise<CloudflareBindings> {
  try {
    const module = await import(/* webpackIgnore: true */ '@opennextjs/cloudflare');
    const context = module.getCloudflareContext({ async: false });
    return context.env as CloudflareBindings;
  } catch (error) {
    throw new Error(
      'The @opennextjs/cloudflare package is required at runtime to access Cloudflare bindings. Ensure it is installed and available.'
    );
  }
}

export async function POST(request: Request) {
  const env = await resolveCloudflareEnv();
  setCloudflareEnv(env);

  if (!env?.AUTOMATION_SCHEDULER) {
    await log({
      level: 'ERROR',
      message: 'Automation scheduler bootstrap attempted without Durable Object binding.',
    });

    return NextResponse.json(
      { error: 'Automation scheduler binding is not configured.' },
      { status: 500 }
    );
  }

  const namespace = env.AUTOMATION_SCHEDULER;
  const stub = namespace.get(namespace.idFromName('automation'));

  let schedulerResponse: Response;
  const requestOrigin = (() => {
    try {
      return new URL(request.url).origin;
    } catch (error) {
      return null;
    }
  })();
  const bootstrapRequestInit: RequestInit = { method: 'POST' };
  if (requestOrigin) {
    bootstrapRequestInit.headers = { 'cf-worker-origin': requestOrigin };
  }
  try {
    schedulerResponse = await stub.fetch('https://automation.scheduler/bootstrap', bootstrapRequestInit);
  } catch (error) {
    await log({
      level: 'ERROR',
      message: 'Failed to reach automation scheduler Durable Object during bootstrap.',
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json(
      { error: 'Failed to communicate with automation scheduler.' },
      { status: 502 }
    );
  }

  const payloadText = await schedulerResponse.text();
  let payload: unknown = null;

  if (payloadText) {
    try {
      payload = JSON.parse(payloadText);
    } catch (error) {
      await log({
        level: 'WARN',
        message: 'Automation scheduler bootstrap returned non-JSON payload.',
        context: { error: error instanceof Error ? error.message : String(error), payloadText },
      });
      payload = payloadText;
    }
  }

  if (!schedulerResponse.ok) {
    await log({
      level: 'ERROR',
      message: 'Automation scheduler Durable Object rejected bootstrap request.',
      context: { status: schedulerResponse.status, payload },
    });

    return NextResponse.json(
      { error: 'Automation scheduler bootstrap failed.', details: payload },
      { status: 502 }
    );
  }

  await log({ level: 'INFO', message: 'Automation scheduler bootstrap completed.', context: payload ?? undefined });

  return NextResponse.json({ status: 'ok', scheduler: payload });
}
