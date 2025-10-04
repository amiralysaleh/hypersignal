import { NextResponse } from 'next/server';
import { getDashboardData } from '@/server/services/dashboard';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({ data });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/dashboard',
      error,
      message: 'Failed to fetch dashboard data',
    });
    const errorMessage = error instanceof Error && error.message
      ? error.message
      : 'Failed to fetch dashboard data';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
