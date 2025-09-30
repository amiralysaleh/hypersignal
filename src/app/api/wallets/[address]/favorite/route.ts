import { NextResponse } from 'next/server';
import { toggleWalletFavorite } from '@/server/services/wallets';

export async function POST(_: Request, { params }: { params: { address: string } }) {
  try {
    const address = decodeURIComponent(params.address);
    const wallet = await toggleWalletFavorite(address);
    return NextResponse.json({ data: wallet });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to toggle favorite' }, { status: 500 });
  }
}
