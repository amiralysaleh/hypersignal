'use client';

export async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
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
