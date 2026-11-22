import { randomUUID } from "node:crypto";
import { readStore, changeStore } from "./demo-store";
import { ServiceError, USE_MOCKS } from "./errors";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { createCommentInputSchema, type Comment } from "@/lib/validators/comment";
import type { Role } from "@/lib/roles";
import { getPrisma } from "@/lib/prisma";

type CommentActor = {
  id: string;
  name: string;
  role: Role;
};

function mapDatabaseComment(comment: {
  id: string;
  eventId: string;
  userId: string;
  text: string;
  createdAt: Date;
  user: { name: string };
}): Comment {
  return {
    id: comment.id,
    eventId: comment.eventId,
    userId: comment.userId,
    userName: comment.user.name,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function getComments(eventId: string): Promise<Comment[]> {
  if (!USE_MOCKS) {
    const comments = await getPrisma().comment.findMany({
      where: { eventId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return comments.map(mapDatabaseComment);
  }

  return readStore()
    .comments.filter((comment) => comment.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPublicComments(eventId: string): Promise<Comment[]> {
  if (!USE_MOCKS) {
    const event = await getPrisma().event.findFirst({
      where: { id: eventId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!event) throw new ServiceError("NOT_FOUND", "Событие недоступно");
  } else {
    const event = readStore().events.find(
      (item) =>
        item.id === eventId &&
        !item.archivedAt &&
        ["PUBLISHED", "FINISHED", "CANCELLED"].includes(item.status),
    );
    if (!event) throw new ServiceError("NOT_FOUND", "Событие недоступно");
  }

  return getComments(eventId);
}

export async function createCommentForUser(
  actor: CommentActor,
  input: unknown,
): Promise<Comment> {
  if (actor.role !== "STUDENT") {
    throw new ServiceError("FORBIDDEN", "Только студенты могут писать комментарии.");
  }

  const parsed = createCommentInputSchema.parse(input);
  if (!USE_MOCKS) {
    const event = await getPrisma().event.findFirst({
      where: { id: parsed.eventId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!event) throw new ServiceError("NOT_FOUND", "Событие недоступно");

    const comment = await getPrisma().comment.create({
      data: {
        eventId: parsed.eventId,
        userId: actor.id,
        text: parsed.text,
      },
      include: { user: { select: { name: true } } },
    });
    return mapDatabaseComment(comment);
  }

  return changeStore((store) => {
    if (
      !store.events.some(
        (event) =>
          event.id === parsed.eventId &&
          !event.archivedAt &&
          ["PUBLISHED", "FINISHED"].includes(event.status),
      )
    ) {
      throw new ServiceError("NOT_FOUND", "Событие недоступно");
    }

    const comment: Comment = {
      ...parsed,
      userId: actor.id,
      userName: actor.name,
      id: `comment-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    store.comments.push(comment);
    return comment;
  });
}

export async function createComment(input: unknown): Promise<Comment> {
  const actor = await requireRole("STUDENT");
  return createCommentForUser(actor, input);
}

export async function deleteCommentForUser(
  actor: Pick<CommentActor, "id" | "role">,
  id: string,
): Promise<string> {
  if (actor.role !== "STUDENT" && actor.role !== "ADMIN") {
    throw new ServiceError("FORBIDDEN", "Нельзя удалить комментарий.");
  }

  if (!USE_MOCKS) {
    const comment = await getPrisma().comment.findUnique({
      where: { id },
      select: { id: true, eventId: true, userId: true },
    });
    if (!comment) throw new ServiceError("NOT_FOUND", "Комментарий не найден");
    if (actor.role !== "ADMIN" && actor.id !== comment.userId) {
      throw new ServiceError("FORBIDDEN", "Нельзя удалить чужой комментарий");
    }

    const deleted = await getPrisma().comment.deleteMany({
      where: {
        id,
        ...(actor.role === "ADMIN" ? {} : { userId: actor.id }),
      },
    });
    if (deleted.count === 0) {
      throw new ServiceError("NOT_FOUND", "Комментарий не найден");
    }
    return comment.eventId;
  }

  return changeStore((store) => {
    const comment = store.comments.find((item) => item.id === id);
    if (!comment) throw new ServiceError("NOT_FOUND", "Комментарий не найден");
    if (actor.role !== "ADMIN" && actor.id !== comment.userId) {
      throw new ServiceError("FORBIDDEN", "Нельзя удалить чужой комментарий");
    }
    store.comments = store.comments.filter((item) => item.id !== id);
    return comment.eventId;
  });
}

export async function deleteComment(id: string): Promise<string> {
  const actor = await getCurrentUser();
  return deleteCommentForUser(actor, id);
}
