import { apiFetch } from './http';
import { mapOrderPaymentDto } from './orderDtos';
import { buildGetOrderPaymentPath } from './workflowRequestBuilders';

export { buildGetOrderPaymentPath } from './workflowRequestBuilders';

export async function getOrderPayment(id: string) {
  const payload = await apiFetch(buildGetOrderPaymentPath(id));
  return mapOrderPaymentDto(payload);
}
