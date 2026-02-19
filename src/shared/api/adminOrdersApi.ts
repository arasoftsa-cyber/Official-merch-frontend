import { apiFetch } from './http';

export async function getAdminOrder(id: string) {
  return apiFetch(`/admin/orders/${id}`);
}

async function attemptFulfill(id: string, method: 'POST' | 'PATCH', path: string) {
  return apiFetch(path, { method });
}

export async function fulfillAdminOrder(id: string) {
  const base = `/admin/orders/${id}`;
  try {
    return await attemptFulfill(id, 'POST', `${base}/fulfill`);
  } catch {
    try {
      return await attemptFulfill(id, 'PATCH', `${base}/fulfill`);
    } catch {
      return attemptFulfill(id, 'POST', `${base}/actions/fulfill`);
    }
  }
}

export async function refundAdminOrder(id: string) {
  const base = `/admin/orders/${id}`;
  try {
    return await attemptFulfill(id, 'POST', `${base}/refund`);
  } catch {
    try {
      return await attemptFulfill(id, 'PATCH', `${base}/refund`);
    } catch {
      return attemptFulfill(id, 'POST', `${base}/actions/refund`);
    }
  }
}
