import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { getPrisma } from "@/lib/prisma";
import { ServiceError, USE_MOCKS } from "./errors";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { createCommentInputSchema } from "@/lib/validators/comment";

export async function getComments(eventId: string) {
  if (USE_MOCKS) {
    return readStore()
      .comments.filter((comment) => comment.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const comments = await getPrisma().comment.findMany({
    where: { eventId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return comments.map(({ user, ...comment }) => ({
    ...comment,
    userName: user.name,
    createdAt: comment.createdAt.toISOString(),
  }));
}

export async function createComment(input: {
  eventId: string;
  userId: string;
  userName: string;
  text: string;
}) {
  const user = await requireRole("STUDENT");
  const parsed = createCommentInputSchema.parse(input);
  if (USE_MOCKS) {
    return changeStore((store) => {
      if (
        !store.events.some(
          (event) =>
            event.id === parsed.eventId &&
            !event.archivedAt &&
            ["PUBLISHED", "FINISHED"].includes(event.status),
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

  const event = await getPrisma().event.findFirst({
    where: {
      id: parsed.eventId,
      archivedAt: null,
      status: { in: ["PUBLISHED", "FINISHED"] },
    },
    select: { id: true },
  });
  if (!event)
    throw new ServiceError("NOT_FOUND", "Событие недоступно");

  const comment = await getPrisma().comment.create({
    data: { eventId: parsed.eventId, userId: user.id, text: parsed.text },
    include: { user: { select: { name: true } } },
  });
  return {
    id: comment.id,
    eventId: comment.eventId,
    userId: comment.userId,
    userName: comment.user.name,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function deleteComment(id: string) {
  const user = await getCurrentUser();
  if (user.role !== "STUDENT" && user.role !== "ADMIN")
    throw new ServiceError("FORBIDDEN", "Это действие недоступно вашей роли.");
  if (USE_MOCKS) {
    return changeStore((store) => {
      const comment = store.comments.find((item) => item.id === id);
      if (!comment) throw new ServiceError("NOT_FOUND", "Комментарий не найден");
      if (
        user.role !== "ADMIN" &&
        !(user.role === "STUDENT" && user.id === comment.userId)
      )
        throw new ServiceError("FORBIDDEN", "Нельзя удалить чужой комментарий");
      store.comments = store.comments.filter((item) => item.id !== id);
      return comment.eventId;
    });
  }
  const comment = await getPrisma().comment.findUnique({
    where: { id },
    select: { id: true, eventId: true, userId: true },
  });
  if (!comment) throw new ServiceError("NOT_FOUND", "Комментарий не найден");
  if (user.role !== "ADMIN" && user.id !== comment.userId)
    throw new ServiceError("FORBIDDEN", "Нельзя удалить чужой комментарий");
  await getPrisma().comment.delete({ where: { id } });
  return comment.eventId;
}
