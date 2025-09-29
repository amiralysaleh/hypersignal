import { NextResponse } from 'next/server';
import { clearAllLogs, readLogs } from '@/backend/log-service';

export async function GET() {
  const logs = await readLogs();
  return NextResponse.json({ logs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  await clearAllLogs();
  return NextResponse.json({ ok: true });
}
