import { createApiContractError, expectRecord } from './contract';

type StartResponse = { attemptId?: string; raw: any };

const START_PAYMENT_DOMAIN = 'payments.start';

export function parseStartPaymentResponse(payload: unknown): StartResponse {
  const source = expectRecord(
    payload,
    START_PAYMENT_DOMAIN,
    'Payment start response must be a JSON object.'
  );
  const attemptId = String(source.attemptId ?? source?.attempt?.id ?? '').trim() || undefined;
  if (!attemptId && source.status !== 'paid') {
    throw createApiContractError(
      START_PAYMENT_DOMAIN,
      'Payment start response is missing a canonical attemptId.'
    );
  }
  return { attemptId, raw: source };
}

export type { StartResponse };
