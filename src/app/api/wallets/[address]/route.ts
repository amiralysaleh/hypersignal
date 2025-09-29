import { NextResponse } from 'next/server';
import { deleteWallet } from '@/backend/wallet-service';

interface Params {
  params: { address: string };
}

export async function DELETE(request: Request, { params }: Params) {
  const { address } = params;
  if (!address) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 });
  }
  try {
    await deleteWallet(decodeURIComponent(address));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to delete wallet.' }, { status: 400 });
  }
}
