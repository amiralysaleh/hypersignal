import { NextResponse } from 'next/server';
import { deleteWallet } from '@/server/services/wallets';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function DELETE(_: Request, { params }: { params: { address: string } }) {
  try {
    const address = decodeURIComponent(params.address);
    await deleteWallet(address);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await logApiError({
      route: 'DELETE /api/wallets/[address]',
      error,
      message: 'Failed to delete wallet',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to delete wallet';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
