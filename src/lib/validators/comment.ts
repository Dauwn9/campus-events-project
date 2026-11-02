import { z } from "zod";

export const commentSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  text: z.string().min(1).max(1000),
  createdAt: z.iso.datetime(),
});

export const createCommentInputSchema = z.object({
  eventId: z.string().min(1),
  text: z.string().trim().min(1, "Напишите комментарий").max(1000),
});

export type Comment = z.infer<typeof commentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
