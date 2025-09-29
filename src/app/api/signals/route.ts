import { NextResponse } from 'next/server';
import { getSignals } from '@/backend/signal-service';

export async function GET() {
  const signals = await getSignals();
  return NextResponse.json({ signals }, { headers: { 'Cache-Control': 'no-store' } });
}
