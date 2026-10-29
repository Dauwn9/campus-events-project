import { z } from "zod";

export const eventStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "CANCELLED",
  "FINISHED",
]);

export const eventSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  location: z.string().min(2).max(120),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  capacity: z.number().int().positive(),
  registeredCount: z.number().int().min(0),
  categoryId: z.string(),
  organizerId: z.string(),
  status: eventStatusSchema,
  imageUrl: z.string().url().optional(),
});

export const eventInputSchema = eventSchema
  .omit({ id: true, registeredCount: true })
  .refine((e) => new Date(e.endsAt) > new Date(e.startsAt), {
    message: "Окончание должно быть позже начала",
    path: ["endsAt"],
  });

export type Event = z.infer<typeof eventSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;