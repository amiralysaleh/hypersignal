import { log } from '@/server/services/logs';

type ApiErrorLogOptions = {
  route: string;
  error: unknown;
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function logApiError({ route, error, message }: ApiErrorLogOptions): Promise<void> {
  const errorMessage = getErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;

  try {
    await log({
      level: 'ERROR',
      message,
      context: {
        route,
        error: errorMessage,
        ...(stack ? { stack } : {}),
      },
    });
  } catch (loggingError) {
    console.error('Failed to record API error log', {
      route,
      originalError: errorMessage,
      loggingError,
    });
  }
}
