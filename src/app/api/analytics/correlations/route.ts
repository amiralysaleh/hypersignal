import { NextResponse } from 'next/server';
import { getWalletCorrelations } from '@/server/services/analytics';

export async function GET() {
  try {
    const data = await getWalletCorrelations();
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch wallet correlations' }, { status: 500 });
  }
}
