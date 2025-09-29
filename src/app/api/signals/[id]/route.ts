import { NextResponse } from 'next/server';
import { deleteSignal } from '@/backend/signal-service';

interface Params {
  params: { id: string };
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Signal id is required.' }, { status: 400 });
  }
  try {
    await deleteSignal(decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to delete signal.' }, { status: 400 });
  }
}
