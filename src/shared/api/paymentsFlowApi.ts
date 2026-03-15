import { apiFetch } from './http';

type StartResponse = { attemptId?: string; raw: any };

function extractAttemptId(payload: any): string | undefined {
  return (
    payload?.attemptId ||
    payload?.id ||
    payload?.paymentAttemptId ||
    payload?.attempt?.id ||
    payload?.data?.attemptId
  );
}

export async function startPayment(orderId: string): Promise<StartResponse> {
  const payload = await apiFetch(`/orders/${orderId}/pay`, { method: 'POST' });
  return { attemptId: extractAttemptId(payload), raw: payload };
}

export async function confirmPayment(orderId: string, attemptId?: string) {
  if (attemptId) {
    return apiFetch(`/payments/attempts/${attemptId}/confirm`, { method: 'POST' });
  }

  return apiFetch(`/orders/${orderId}/pay/confirm`, { method: 'POST' });
}
