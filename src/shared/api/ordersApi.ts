import { apiFetch } from './http';
import { mapOrderDetailDto, mapOrderEventsPayload } from './orderDtos';
import {
  buildCancelOrderRequest,
  buildGetOrderEventsPath,
  buildGetOrderPath,
} from './workflowRequestBuilders';

export { buildCancelOrderRequest, buildGetOrderEventsPath, buildGetOrderPath } from './workflowRequestBuilders';

export async function getOrder(id: string) {
  const payload = await apiFetch(buildGetOrderPath(id));
  return mapOrderDetailDto(payload);
}

export async function getOrderEvents(id: string) {
  const payload = await apiFetch(buildGetOrderEventsPath(id));
  return mapOrderEventsPayload(payload);
}

export async function cancelOrder(id: string) {
  const request = buildCancelOrderRequest(id);
  return apiFetch(request.path, { method: request.method });
}
