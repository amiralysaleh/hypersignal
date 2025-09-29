import { NextResponse } from 'next/server';
import { getDashboardData } from '@/backend/dashboard-service';

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
