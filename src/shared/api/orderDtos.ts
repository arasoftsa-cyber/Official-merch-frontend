import { createApiContractError, readArrayEnvelope, readObjectEnvelope } from './contract';

export const ORDER_STATUS_VALUES = [
  'pending',
  'placed',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'unknown',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = [
  'unpaid',
  'pending',
  'processing',
  'paid',
  'captured',
  'failed',
  'cancelled',
  'refunded',
  'unknown',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export type OrderItemDto = {
  id: string;
  productId: string;
  productVariantId: string;
  quantity: number;
  priceCents: number | null;
  size: string;
  color: string;
  sku: string;
};

export type OrderEventDto = {
  type: string;
  at: string | null;
  reason: string;
  note: string;
};

export type OrderPaymentDto = {
  paymentId: string;
  status: PaymentStatus;
  provider: string;
  attemptId: string | null;
};

export type OrderDetailDto = {
  id: string;
  status: OrderStatus;
  totalCents: number | null;
  createdAt: string | null;
  buyerUserId: string;
  payment: OrderPaymentDto;
  items: OrderItemDto[];
  events: OrderEventDto[];
};

export type OrderListItemDto = Pick<OrderDetailDto, 'id' | 'status' | 'totalCents' | 'createdAt'> & {
  paymentStatus: PaymentStatus;
};

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readMoneyCents = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = readNumber(value);
    if (parsed === null) continue;
    return Number.isInteger(parsed) ? parsed : Math.round(parsed * 100);
  }
  return null;
};

const normalizeToken = (value: unknown) =>
  readText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const normalizeOrderStatus = (value: unknown): OrderStatus => {
  const normalized = normalizeToken(value);
  switch (normalized) {
    case 'pending':
    case 'awaiting_payment':
      return 'pending';
    case 'placed':
    case 'unpaid':
    case 'pending_payment':
      return 'placed';
    case 'paid':
      return 'paid';
    case 'fulfilled':
    case 'complete':
    case 'completed':
      return 'fulfilled';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'refund':
    case 'refunded':
      return 'refunded';
    default:
      return 'unknown';
  }
};

export const normalizePaymentStatus = (value: unknown): PaymentStatus => {
  const normalized = normalizeToken(value);
  switch (normalized) {
    case 'unpaid':
    case 'requires_payment':
      return 'unpaid';
    case 'pending':
    case 'pending_payment':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'paid':
      return 'paid';
    case 'captured':
      return 'captured';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'refund':
    case 'refunded':
      return 'refunded';
    default:
      return 'unknown';
  }
};

const normalizeOrderEventType = (value: unknown): string => {
  const normalized = normalizeToken(value);
  if (!normalized) return 'event';
  if (normalized === 'order_created') return 'placed';
  if (normalized === 'payment_captured') return 'paid';
  return normalized;
};

const ORDER_DETAIL_DOMAIN = 'orders.detail';
const ORDER_EVENTS_DOMAIN = 'orders.events';
const ORDER_LIST_DOMAIN = 'orders.list';

const readOptionalRecord = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

const readOrderCore = (payload: unknown): Record<string, any> =>
  readObjectEnvelope(payload, 'order', ORDER_DETAIL_DOMAIN, { allowDirect: true });

const readOrderId = (raw: Record<string, any>): string => readText(raw.id ?? raw.orderId);

const requireOrderId = (raw: Record<string, any>): string => {
  const id = readOrderId(raw);
  if (!id) {
    throw createApiContractError(ORDER_DETAIL_DOMAIN, 'Order payload is missing a canonical id.');
  }
  return id;
};

export const mapOrderEventDto = (raw: any): OrderEventDto => ({
  type: normalizeOrderEventType(raw?.type ?? raw?.event),
  at: readText(raw?.at ?? raw?.createdAt ?? raw?.created_at) || null,
  reason: readText(raw?.reason),
  note: readText(raw?.note ?? raw?.message),
});

export const mapOrderEventsPayload = (payload: any): OrderEventDto[] => {
  const items = readArrayEnvelope(payload, 'items', ORDER_EVENTS_DOMAIN, { allowDirectArray: true });
  return items.map((item) => mapOrderEventDto(item));
};

export const mapOrderPaymentDto = (raw: any, orderStatus?: OrderStatus): OrderPaymentDto => {
  const payment = readOptionalRecord(raw?.payment) ?? {};
  const status =
    normalizePaymentStatus(
      payment?.status ?? raw?.paymentStatus
    ) || (orderStatus === 'paid' ? 'paid' : 'unknown');

  return {
    paymentId: readText(payment?.paymentId ?? payment?.id),
    status: status === 'unknown' && orderStatus === 'paid' ? 'paid' : status,
    provider: readText(payment?.provider),
    attemptId: readText(payment?.attemptId ?? raw?.paymentAttemptId ?? raw?.attemptId) || null,
  };
};

export const mapOrderItemDto = (raw: any): OrderItemDto => ({
  id: readText(raw?.id),
  productId: readText(raw?.productId ?? raw?.product_id),
  productVariantId: readText(raw?.productVariantId ?? raw?.product_variant_id),
  quantity: readNumber(raw?.quantity) ?? 0,
  priceCents: readMoneyCents(raw?.priceCents, raw?.price_cents, raw?.price),
  size: readText(raw?.size),
  color: readText(raw?.color),
  sku: readText(raw?.sku),
});

export const mapOrderDetailDto = (payload: any): OrderDetailDto => {
  const raw = readOrderCore(payload);
  const id = requireOrderId(raw);
  const status = normalizeOrderStatus(raw?.status ?? raw?.state);
  const payment = mapOrderPaymentDto(raw, status);
  const itemsRaw = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.orderItems) ? raw.orderItems : [];
  const eventsSource = raw?.events ?? raw?.orderEvents ?? { items: [] };
  const events = mapOrderEventsPayload(eventsSource);

  return {
    id,
    status,
    totalCents: readMoneyCents(raw?.totalCents, raw?.total_cents, raw?.total, raw?.amount),
    createdAt: readText(raw?.createdAt ?? raw?.created_at) || null,
    buyerUserId: readText(raw?.buyerUserId ?? raw?.buyer_user_id),
    payment,
    items: itemsRaw.map((item: any) => mapOrderItemDto(item)),
    events,
  };
};

export const mapOrderListItemDto = (raw: any): OrderListItemDto => {
  const detail = mapOrderDetailDto(raw);
  return {
    id: detail.id,
    status: detail.status,
    totalCents: detail.totalCents,
    createdAt: detail.createdAt,
    paymentStatus: detail.payment.status,
  };
};

export const mapOrderListPayload = (payload: any): OrderListItemDto[] => {
  const items = readArrayEnvelope(payload, 'items', ORDER_LIST_DOMAIN, {
    allowDirectArray: true,
    legacyKey: 'orders',
  });
  return items.map((item: any) => mapOrderListItemDto(item));
};
