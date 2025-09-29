import { NextResponse } from 'next/server';
import { predictSignalSuccess } from '@/server/services/analytics';

export async function GET() {
  try {
    const data = await predictSignalSuccess();
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to predict signal success' }, { status: 500 });
  }
}
