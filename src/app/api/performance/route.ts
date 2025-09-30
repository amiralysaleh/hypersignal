import { NextResponse } from 'next/server';
import { getPerformanceData } from '@/server/services/performance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') ?? '30d';
    const data = await getPerformanceData(timeframe);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch performance data' }, { status: 500 });
  }
}
