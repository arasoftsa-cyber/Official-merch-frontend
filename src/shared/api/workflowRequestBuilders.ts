export const buildGetOrderPath = (id: string) => `/orders/${id}`;
export const buildGetOrderEventsPath = (id: string) => `/orders/${id}/events`;
export const buildCancelOrderRequest = (id: string) =>
  ({
    path: `/orders/${id}/cancel`,
    method: 'POST' as const,
  });

export const buildGetOrderPaymentPath = (id: string) => `/orders/${id}/payment`;

export const buildStartPaymentRequest = (orderId: string) =>
  ({
    path: `/orders/${orderId}/pay`,
    method: 'POST' as const,
  });

export const buildConfirmPaymentRequest = (orderId: string, attemptId?: string) =>
  ({
    path: attemptId ? `/payments/attempts/${attemptId}/confirm` : `/orders/${orderId}/pay/confirm`,
    method: 'POST' as const,
  });

export const buildGetAdminOrderPath = (id: string) => `/admin/orders/${id}`;
export const buildFulfillAdminOrderRequest = (id: string) =>
  ({
    path: `/admin/orders/${id}/fulfill`,
    method: 'POST' as const,
  });
export const buildRefundAdminOrderRequest = (id: string) =>
  ({
    path: `/admin/orders/${id}/refund`,
    method: 'POST' as const,
  });
