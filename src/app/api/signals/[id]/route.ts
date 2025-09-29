import { NextResponse } from 'next/server';
import { deleteSignal } from '@/server/services/signals';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = decodeURIComponent(params.id);
    await deleteSignal(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete signal' }, { status: 500 });
  }
}
