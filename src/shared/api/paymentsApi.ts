import { apiFetch } from './http';

export async function getOrderPayment(id: string) {
  let firstError: any;
  try {
    return await apiFetch(`/orders/${id}/payment`);
  } catch (err) {
    firstError = err;
  }

  try {
    return await apiFetch(`/payments/order/${id}`);
  } catch (err) {
    if (!firstError) firstError = err;
  }

  try {
    return await apiFetch(`/payments/summary/order/${id}`);
  } catch {
    throw firstError;
  }
}
