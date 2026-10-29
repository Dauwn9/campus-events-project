import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(50),
  slug: z.string().regex(/^[a-z0-9-]+$/),
});

export const categoryInputSchema = categorySchema.omit({ id: true });

export type Category = z.infer<typeof categorySchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
