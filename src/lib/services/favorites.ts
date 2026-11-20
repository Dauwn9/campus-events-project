import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { toggleFavoriteInputSchema } from "@/lib/validators/favorite";
import { ServiceError } from "./errors";
import { eventInclude, toEventDto } from "./event-prisma";

function isRetryableTransactionError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "P2034" || error.code === "P2002";
}

export async function getMyFavorites() {
  const user = await requireRole("STUDENT");
  const favorites = await getPrisma().favorite.findMany({
    where: {
      userId: user.id,
      event: {
        archivedAt: null,
        status: { in: ["PUBLISHED", "FINISHED"] },
      },
    },
    include: { event: { include: eventInclude } },
    orderBy: { createdAt: "desc" },
  });

  return favorites.map((favorite) => ({
    userId: favorite.userId,
    eventId: favorite.eventId,
    createdAt: favorite.createdAt.toISOString(),
    event: toEventDto(favorite.event),
  }));
}

export async function getMyFavoriteIds() {
  const user = await requireRole("STUDENT");
  const favorites = await getPrisma().favorite.findMany({
    where: {
      userId: user.id,
      event: {
        archivedAt: null,
        status: { in: ["PUBLISHED", "FINISHED"] },
      },
    },
    select: { eventId: true },
  });
  return favorites.map((favorite) => favorite.eventId);
}

export async function toggleFavoriteForActor(
  user: { id: string; role: string },
  id: string,
) {
  if (!user.id || user.role !== "STUDENT") {
    throw new ServiceError(
      "FORBIDDEN",
      "Это действие недоступно вашей роли.",
    );
  }
  const { eventId } = toggleFavoriteInputSchema.parse({ eventId: id });
  const prisma = getPrisma();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const event = await transaction.event.findFirst({
            where: {
              id: eventId,
              archivedAt: null,
              status: { in: ["PUBLISHED", "FINISHED"] },
            },
            select: { id: true },
          });
          if (!event) {
            throw new ServiceError("NOT_FOUND", "Событие недоступно.");
          }

          const key = {
            userId_eventId: { userId: user.id, eventId },
          };
          const favorite = await transaction.favorite.findUnique({
            where: key,
            select: { userId: true },
          });

          if (favorite) {
            await transaction.favorite.delete({ where: key });
            return { eventId, isFavorite: false };
          }

          await transaction.favorite.upsert({
            where: key,
            create: { userId: user.id, eventId },
            update: {},
          });
          return { eventId, isFavorite: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) throw error;
    }
  }

  throw new Error("Не удалось переключить избранное после повтора транзакции.");
}

export async function toggleFavorite(id: string) {
  return toggleFavoriteForActor(await requireRole("STUDENT"), id);
}
