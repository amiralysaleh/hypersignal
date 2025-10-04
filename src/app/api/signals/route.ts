import { NextResponse } from 'next/server';
import { updateSignalPrices } from '@/server/services/signals';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const signals = await updateSignalPrices();
    const sortedSignals = [...signals].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return NextResponse.json({ data: sortedSignals });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/signals',
      error,
      message: 'Failed to fetch signals',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to fetch signals';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
