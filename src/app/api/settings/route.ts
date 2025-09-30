import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type Settings } from '@/server/services/settings';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ data: settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const newSettings = (await request.json()) as Settings;
    await saveSettings(newSettings);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save settings' }, { status: 500 });
  }
}
