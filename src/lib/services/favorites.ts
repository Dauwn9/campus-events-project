import { requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
import { toggleStudentFavorite } from "./campus";
import { getPrisma } from "@/lib/prisma";
import { ServiceError, USE_MOCKS } from "./errors";
import { toggleFavoriteInputSchema } from "@/lib/validators/favorite";

export async function getMyFavorites() {
  const user = await requireRole("STUDENT");
  if (!USE_MOCKS) {
    const favorites = await getPrisma().favorite.findMany({
      where: { userId: user.id },
      include: {
        event: {
          include: {
            _count: {
              select: {
                registrations: {
                  where: { status: "CONFIRMED" },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return favorites
      .filter((favorite) => favorite.event.status === "PUBLISHED")
      .map((favorite) => ({
        userId: favorite.userId,
        eventId: favorite.eventId,
        createdAt: favorite.createdAt.toISOString(),
        event: {
          id: favorite.event.id,
          title: favorite.event.title,
          description: favorite.event.description,
          location: favorite.event.location,
          startsAt: favorite.event.startsAt.toISOString(),
          endsAt: favorite.event.endsAt.toISOString(),
          capacity: favorite.event.capacity,
          registeredCount: favorite.event._count.registrations,
          categoryId: favorite.event.categoryId,
          organizerId: favorite.event.organizerId,
          status: "PUBLISHED" as const,
          imageUrl: favorite.event.coverUrl ?? undefined,
          rejectionReason: favorite.event.rejectionReason ?? undefined,
          registrationOpensAt:
            favorite.event.registrationOpensAt?.toISOString() ?? undefined,
          priorityWindowHours: favorite.event.priorityWindowHours,
          archivedAt: null,
        },
      }));
  }

  const store = readStore();
  return store.favorites
    .filter((f) => f.userId === user.id)
    .flatMap((f) => {
      const event = store.events.find(
        (e) =>
          e.id === f.eventId &&
          !e.archivedAt &&
          !e.archivedAt &&
          ["PUBLISHED", "FINISHED"].includes(e.status),
      );
      return event ? [{ ...f, event }] : [];
    });
}
export async function getMyFavoriteIds() {
  return (await getMyFavorites()).map((f) => f.eventId);
}
export async function toggleFavorite(input: string | { eventId: string }) {
  const user = await requireRole("STUDENT");
  const { eventId } = toggleFavoriteInputSchema.parse(
    typeof input === "string" ? { eventId: input } : input,
  );

  if (!USE_MOCKS) {
    const event = await getPrisma().event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true },
    });
    if (!event || event.status !== "PUBLISHED") {
      throw new ServiceError("NOT_FOUND", "Событие недоступно.");
    }

    const key = { userId: user.id, eventId };
    const existing = await getPrisma().favorite.findUnique({ where: { userId_eventId: key } });
    if (existing) {
      await getPrisma().favorite.delete({ where: { userId_eventId: key } });
      return { eventId, isFavorite: false };
    }

    await getPrisma().favorite.create({ data: key });
    return { eventId, isFavorite: true };
  }

  return toggleStudentFavorite(user, eventId);
}
