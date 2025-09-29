import { NextResponse } from 'next/server';
import { clearLogs, getLogs } from '@/server/services/logs';

export async function GET() {
  try {
    const logs = await getLogs();
    return NextResponse.json({ data: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearLogs();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to clear logs' }, { status: 500 });
  }
}
