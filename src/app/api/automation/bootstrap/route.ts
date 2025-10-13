import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { setCloudflareEnv, type CloudflareBindings } from '@/server/storage/env';
import { log } from '@/server/services/logs';

export async function POST() {
  const context = getCloudflareContext({ async: false });
  const env = context.env as CloudflareBindings;
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
  try {
    schedulerResponse = await stub.fetch('https://automation.scheduler/bootstrap', { method: 'POST' });
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
