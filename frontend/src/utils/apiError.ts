// frontend/src/utils/apiError.ts
//
// Lê a mensagem/status de um erro do axios sem precisar tipar o `catch` como `any`.

interface ApiErrorShape {
    response?: { status?: number; data?: { message?: string | string[] } };
    message?: string;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
    const shaped = error as ApiErrorShape | null;
    const message = shaped?.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    return message || shaped?.message || fallback;
}

export function apiErrorStatus(error: unknown): number | undefined {
    return (error as ApiErrorShape | null)?.response?.status;
}
