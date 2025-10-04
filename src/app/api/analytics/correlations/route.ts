import { NextResponse } from 'next/server';
import { getWalletCorrelations } from '@/server/services/analytics';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const data = await getWalletCorrelations();
    return NextResponse.json({ data });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/analytics/correlations',
      error,
      message: 'Failed to fetch wallet correlations',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to fetch wallet correlations';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
