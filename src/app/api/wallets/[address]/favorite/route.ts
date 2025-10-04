import { NextResponse } from 'next/server';
import { toggleWalletFavorite } from '@/server/services/wallets';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function POST(_: Request, { params }: { params: { address: string } }) {
  try {
    const address = decodeURIComponent(params.address);
    const wallet = await toggleWalletFavorite(address);
    return NextResponse.json({ data: wallet });
  } catch (error: unknown) {
    await logApiError({
      route: 'POST /api/wallets/[address]/favorite',
      error,
      message: 'Failed to toggle favorite',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to toggle favorite';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
