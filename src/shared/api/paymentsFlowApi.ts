import { apiFetch } from './http';
import { parseStartPaymentResponse, type StartResponse } from './paymentsFlowDtos';
import {
  buildConfirmPaymentRequest,
  buildStartPaymentRequest,
} from './workflowRequestBuilders';

export { buildConfirmPaymentRequest, buildStartPaymentRequest } from './workflowRequestBuilders';

export async function startPayment(orderId: string): Promise<StartResponse> {
  const request = buildStartPaymentRequest(orderId);
  const payload = await apiFetch(request.path, { method: request.method });
  return parseStartPaymentResponse(payload);
}

export async function confirmPayment(orderId: string, attemptId?: string) {
  const request = buildConfirmPaymentRequest(orderId, attemptId);
  return apiFetch(request.path, { method: request.method });
}
