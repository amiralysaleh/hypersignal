import { NextResponse } from 'next/server';
import { addWallet, getWallets } from '@/server/services/wallets';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function GET() {
  try {
    const wallets = await getWallets();
    return NextResponse.json({ data: wallets });
  } catch (error: unknown) {
    await logApiError({
      route: 'GET /api/wallets',
      error,
      message: 'Failed to fetch wallets',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to fetch wallets';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
    const { address } = body;
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }
    const wallet = await addWallet(address);
    return NextResponse.json({ data: wallet }, { status: 201 });
  } catch (error: unknown) {
    await logApiError({
      route: 'POST /api/wallets',
      error,
      message: 'Failed to add wallet',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to add wallet';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
