import { NextResponse } from 'next/server';
import { getPerformanceData } from '@/backend/performance-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') ?? '30d';
  const data = await getPerformanceData(timeframe);
  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
