import { NextResponse } from 'next/server';
import { getWalletCorrelations } from '@/backend/analytics-service';

export async function GET() {
  const correlations = await getWalletCorrelations();
  return NextResponse.json(correlations, { headers: { 'Cache-Control': 'no-store' } });
}
