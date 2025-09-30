import { NextResponse } from 'next/server';
import { updateSignalPrices } from '@/server/services/signals';

export async function POST() {
  try {
    const signals = await updateSignalPrices();
    return NextResponse.json({ data: signals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update signal prices' }, { status: 500 });
  }
}
