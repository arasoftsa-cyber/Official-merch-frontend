import { apiFetch } from './http';
import { mapOrderPaymentDto } from './orderDtos';

export async function getOrderPayment(id: string) {
  const payload = await apiFetch(`/orders/${id}/payment`);
  return mapOrderPaymentDto(payload);
}
