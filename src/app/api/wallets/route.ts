import { NextResponse } from 'next/server';
import { addWallet, getWallets } from '@/backend/wallet-service';

export async function GET() {
  const wallets = await getWallets();
  return NextResponse.json({ wallets }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { address } = body as { address?: string };
  if (!address || typeof address !== 'string') {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 });
  }
  try {
    const wallet = await addWallet(address.trim());
    return NextResponse.json(wallet, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to add wallet.' }, { status: 400 });
  }
}
