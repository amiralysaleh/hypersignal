import { NextResponse } from 'next/server';
import { detectAndSaveSignals, getSignals } from '@/server/services/signals';

export async function POST() {
  try {
    await detectAndSaveSignals();
    const signals = await getSignals();
    return NextResponse.json({ data: signals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to detect signals' }, { status: 500 });
  }
}
