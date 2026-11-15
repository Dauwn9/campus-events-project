import { z } from "zod";

export const eventQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(6),
});

export type EventListQuery = z.infer<typeof eventQuerySchema>;