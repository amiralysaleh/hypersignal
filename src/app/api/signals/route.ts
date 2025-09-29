import { NextResponse } from 'next/server';
import { getSignals } from '@/server/services/signals';

export async function GET() {
  try {
    const signals = await getSignals();
    return NextResponse.json({ data: signals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch signals' }, { status: 500 });
  }
}
