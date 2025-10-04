import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type Settings } from '@/server/services/settings';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ data: settings });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/settings',
      error,
      message: 'Failed to fetch settings',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to fetch settings';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const newSettings = (await request.json()) as Settings;
    await saveSettings(newSettings);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await logApiError({
      route: 'PUT /api/settings',
      error,
      message: 'Failed to save settings',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to save settings';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
