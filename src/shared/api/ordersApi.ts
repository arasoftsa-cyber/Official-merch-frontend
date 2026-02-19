import { apiFetch } from './http';

export async function getOrder(id: string) {
  return apiFetch(`/orders/${id}`);
}

export async function getOrderEvents(id: string) {
  return apiFetch(`/orders/${id}/events`);
}

export async function cancelOrder(id: string) {
  try {
    return await apiFetch(`/orders/${id}/cancel`, { method: 'POST' });
  } catch (err) {
    try {
      return await apiFetch(`/orders/${id}/cancel`, { method: 'PATCH' });
    } catch (err) {
      return apiFetch(`/orders/${id}/actions/cancel`, { method: 'POST' });
    }
  }
}
