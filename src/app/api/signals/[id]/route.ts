import { NextResponse } from 'next/server';
import { deleteSignal } from '@/server/services/signals';
import { logApiError } from '@/server/utils/apiErrorLogger';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = decodeURIComponent(params.id);
    await deleteSignal(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await logApiError({
      route: 'DELETE /api/signals/[id]',
      error,
      message: 'Failed to delete signal',
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to delete signal';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
