import { NextResponse } from 'next/server';
import { toggleWalletFavorite } from '@/backend/wallet-service';

interface Params {
  params: { address: string };
}

export async function POST(request: Request, { params }: Params) {
  const { address } = params;
  if (!address) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 });
  }
  try {
    const wallet = await toggleWalletFavorite(decodeURIComponent(address));
    return NextResponse.json(wallet);
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to toggle favorite.' }, { status: 400 });
  }
}
