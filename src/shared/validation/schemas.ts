import { z } from 'zod';

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(['admin', 'artist', 'label', 'buyer']),
  }),
});

export const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['placed', 'paid', 'fulfilled', 'cancelled', 'refunded']),
  totalCents: z.number().int().nonnegative(),
  createdAt: z.string(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productVariantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
  })),
});

export function validateApiResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
