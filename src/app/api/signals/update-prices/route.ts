import { NextResponse } from 'next/server';
import { updateSignalPrices } from '@/server/services/signals';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function POST() {
  try {
    const signals = await updateSignalPrices();
    return NextResponse.json({ data: signals });
  } catch (error: unknown) {
    await logApiError({
      route: 'POST /api/signals/update-prices',
      error,
      message: 'Failed to update signal prices',
    });
    const errorMessage = error instanceof Error && error.message
      ? error.message
      : 'Failed to update signal prices';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
