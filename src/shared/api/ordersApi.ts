import { apiFetch } from './http';
import { mapOrderDetailDto, mapOrderEventsPayload } from './orderDtos';

export async function getOrder(id: string) {
  const payload = await apiFetch(`/orders/${id}`);
  return mapOrderDetailDto(payload);
}

export async function getOrderEvents(id: string) {
  const payload = await apiFetch(`/orders/${id}/events`);
  return mapOrderEventsPayload(payload);
}

export async function cancelOrder(id: string) {
  return apiFetch(`/orders/${id}/cancel`, { method: 'POST' });
}
