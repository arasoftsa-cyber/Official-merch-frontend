import { apiFetch } from './http';
import { parseStartPaymentResponse, type StartResponse } from './paymentsFlowDtos';

export async function startPayment(orderId: string): Promise<StartResponse> {
  const payload = await apiFetch(`/orders/${orderId}/pay`, { method: 'POST' });
  // return parseStartPaymentResponse(payload);
  return payload;
}

export async function changePaymentStatusToPaid(data: any) {
  return apiFetch(`/orders/paid`, { method: 'POST', body: data });
}

export async function confirmPayment(orderId: string, attemptId?: string) {
  if (attemptId) {
    return apiFetch(`/payments/attempts/${attemptId}/confirm`, { method: 'POST' });
  }

  return apiFetch(`/orders/${orderId}/pay/confirm`, { method: 'POST' });
}
