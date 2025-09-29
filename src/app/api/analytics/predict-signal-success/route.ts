import { NextResponse } from 'next/server';
import { predictSignalSuccess } from '@/backend/analytics-service';

export async function GET() {
  const prediction = await predictSignalSuccess();
  return NextResponse.json(prediction, { headers: { 'Cache-Control': 'no-store' } });
}
