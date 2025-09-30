import { NextResponse } from 'next/server';
import { getDashboardData } from '@/server/services/dashboard';

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
