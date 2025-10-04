import { NextResponse } from 'next/server';
import { getPerformanceData } from '@/server/services/performance';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') ?? '30d';
    const data = await getPerformanceData(timeframe);
    return NextResponse.json({ data });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/performance',
      error,
      message: 'Failed to fetch performance data',
    });
    const errorMessage = error instanceof Error && error.message
      ? error.message
      : 'Failed to fetch performance data';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
