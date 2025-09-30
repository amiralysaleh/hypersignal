'use client';

export async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const finalInit: RequestInit = { ...(init ?? {}) };
  if (finalInit.cache === undefined) {
    finalInit.cache = 'no-store';
  }
  if (finalInit.credentials === undefined) {
    finalInit.credentials = 'same-origin';
  }

  let response: Response;
  try {
    response = await fetch(input, finalInit);
  } catch (error: any) {
    const message = error?.message ?? 'Network request failed';
    throw new Error(message);
  }

  let body: any = null;

  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (!response.ok) {
    const message = body?.error ?? response.statusText;
    throw new Error(message);
  }

  return (body?.data ?? body) as T;
}
