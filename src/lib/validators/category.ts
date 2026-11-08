import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(50),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  archivedAt: z.iso.datetime().nullable().optional(),
});

export const categoryInputSchema = categorySchema.omit({
  id: true,
  archivedAt: true,
});

export type Category = z.infer<typeof categorySchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
