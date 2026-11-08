import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { ServiceError } from "./errors";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { createCommentInputSchema } from "@/lib/validators/comment";
export async function getComments(eventId: string) {
  return readStore()
    .comments.filter((c) => c.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createComment(input: {
  eventId: string;
  userId: string;
  userName: string;
  text: string;
}) {
  const user = await requireRole("STUDENT");
  const parsed = createCommentInputSchema.parse(input);
  return changeStore((store) => {
    if (
      !store.events.some(
        (e) =>
          e.id === parsed.eventId &&
          !e.archivedAt &&
          ["PUBLISHED", "FINISHED"].includes(e.status),
      )
    )
      throw new ServiceError("NOT_FOUND", "Событие недоступно");
    const comment = {
      ...parsed,
      userId: user.id,
      userName: user.name,
      id: `comment-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    store.comments.push(comment);
    return comment;
  });
}
export async function deleteComment(id: string) {
  const user = await getCurrentUser();
  return changeStore((store) => {
    const comment = store.comments.find((c) => c.id === id);
    if (!comment) throw new ServiceError("NOT_FOUND", "Комментарий не найден");
    if (
      user.role !== "ADMIN" &&
      !(user.role === "STUDENT" && user.id === comment.userId)
    )
      throw new ServiceError("FORBIDDEN", "Нельзя удалить чужой комментарий");
    store.comments = store.comments.filter((c) => c.id !== id);
    return comment.eventId;
  });
}
