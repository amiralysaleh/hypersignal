import { NextResponse } from 'next/server';
import { deleteWallet } from '@/server/services/wallets';

export async function DELETE(_: Request, { params }: { params: { address: string } }) {
  try {
    const address = decodeURIComponent(params.address);
    await deleteWallet(address);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete wallet' }, { status: 500 });
  }
}
