import { NextResponse } from 'next/server';
import { updateSignalPrices } from '@/server/services/signals';

export async function GET() {
  try {
    const signals = await updateSignalPrices();
    const sortedSignals = [...signals].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return NextResponse.json({ data: sortedSignals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch signals' }, { status: 500 });
  }
}
