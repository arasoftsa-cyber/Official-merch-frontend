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
  const endpoints = [
    [`/orders/${orderId}/pay`, { method: 'POST' }],
    ['/payments/start', { method: 'POST', body: { orderId } }],
    ['/payments/attempts', { method: 'POST', body: { orderId } }],
  ];

  let lastError: any;
  for (const [url, options] of endpoints) {
    try {
      const payload = await apiFetch(url, options);
      return { attemptId: extractAttemptId(payload), raw: payload };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function confirmPayment(orderId: string, attemptId?: string) {
  const attemptPaths = [
    [`/payments/attempts/${attemptId}/confirm`, { method: 'POST' }],
    ['/payments/confirm', { method: 'POST', body: { attemptId } }],
    [`/orders/${orderId}/pay/confirm`, { method: 'POST', body: { attemptId } }],
  ];

  if (attemptId) {
    let lastError: any;
    for (const [url, options] of attemptPaths) {
      try {
        return await apiFetch(url, options);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  return apiFetch('/payments/confirm', { method: 'POST', body: { orderId } });
}
