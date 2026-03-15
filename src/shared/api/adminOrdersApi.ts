import { apiFetch } from './http';
import { mapOrderDetailDto } from './orderDtos';

export async function getAdminOrder(id: string) {
  const payload = await apiFetch(`/admin/orders/${id}`);
  return mapOrderDetailDto(payload);
}

export async function fulfillAdminOrder(id: string) {
  return apiFetch(`/admin/orders/${id}/fulfill`, { method: 'POST' });
}

export async function refundAdminOrder(id: string) {
  return apiFetch(`/admin/orders/${id}/refund`, { method: 'POST' });
}
