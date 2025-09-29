import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/backend/settings-service';
import type { Settings } from '@/types/settings';

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Settings>;
  const current = await getSettings();
  const nextSettings = { ...current, ...body } as Settings;
  await saveSettings(nextSettings);
  return NextResponse.json(nextSettings);
}
