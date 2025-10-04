import { NextResponse } from 'next/server';
import { clearLogs, getLogs } from '@/server/services/logs';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const logs = await getLogs();
    return NextResponse.json({ data: logs });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/logs',
      error,
      message: 'Failed to fetch logs',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to fetch logs';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearLogs();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await logApiError({
      route: 'DELETE /api/logs',
      error,
      message: 'Failed to clear logs',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to clear logs';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
