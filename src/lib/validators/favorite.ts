import { z } from "zod";



export const favoriteSchema = z.object({
  userId: z.string().min(1),
  eventId: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Favorite = z.infer<typeof favoriteSchema>;

export const favoriteEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  location: z.string(),
  startsAt: z.string().datetime(),
});

export const favoriteWithEventSchema = favoriteSchema.extend({ event: favoriteEventSchema });
export type FavoriteWithEvent = z.infer<typeof favoriteWithEventSchema>;

export const toggleFavoriteInputSchema = z.object({ eventId: z.string().min(1) });
export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteInputSchema>;

export const toggleFavoriteResultSchema = z.object({
  eventId: z.string(),
  isFavorite: z.boolean(),
});
export type ToggleFavoriteResult = z.infer<typeof toggleFavoriteResultSchema>;