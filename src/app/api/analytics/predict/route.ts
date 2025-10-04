import { NextResponse } from 'next/server';
import { predictSignalSuccess } from '@/server/services/analytics';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const data = await predictSignalSuccess();
    return NextResponse.json({ data });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/analytics/predict',
      error,
      message: 'Failed to predict signal success',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to predict signal success';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
