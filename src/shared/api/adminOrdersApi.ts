import { apiFetch } from './http';
import { mapOrderDetailDto } from './orderDtos';
import {
  buildFulfillAdminOrderRequest,
  buildGetAdminOrderPath,
  buildRefundAdminOrderRequest,
} from './workflowRequestBuilders';

export {
  buildFulfillAdminOrderRequest,
  buildGetAdminOrderPath,
  buildRefundAdminOrderRequest,
} from './workflowRequestBuilders';

export async function getAdminOrder(id: string) {
  const payload = await apiFetch(buildGetAdminOrderPath(id));
  return mapOrderDetailDto(payload);
}

export async function fulfillAdminOrder(id: string) {
  const request = buildFulfillAdminOrderRequest(id);
  return apiFetch(request.path, { method: request.method });
}

export async function refundAdminOrder(id: string) {
  const request = buildRefundAdminOrderRequest(id);
  return apiFetch(request.path, { method: request.method });
}
