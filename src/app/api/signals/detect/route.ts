import { NextResponse } from 'next/server';
import { detectAndSaveSignals, getSignals } from '@/server/services/signals';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function POST() {
  try {
    await detectAndSaveSignals();
    const signals = await getSignals();
    return NextResponse.json({ data: signals });
  } catch (error: unknown) {
    await logApiError({
      route: 'POST /api/signals/detect',
      error,
      message: 'Failed to detect signals',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to detect signals';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
