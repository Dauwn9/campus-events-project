import type { Prisma } from "@/generated/prisma/client";
import type { Event } from "@/lib/validators/event";

export const eventInclude = {
  _count: {
    select: {
      registrations: { where: { status: "CONFIRMED" } },
    },
  },
  priorityMembers: { select: { userId: true } },
} satisfies Prisma.EventInclude;

export type PrismaEvent = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

export function toEventDto(event: PrismaEvent): Event {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    capacity: event.capacity,
    registeredCount: event._count.registrations,
    categoryId: event.categoryId,
    organizerId: event.organizerId,
    status: event.status,
    archivedAt: event.archivedAt?.toISOString() ?? null,
    imageUrl: event.coverUrl ?? undefined,
    rejectionReason: event.rejectionReason ?? undefined,
    registrationOpensAt:
      event.registrationOpensAt?.toISOString() ?? undefined,
    priorityWindowHours: event.priorityWindowHours,
    priorityMembers: event.priorityMembers.map(({ userId }) => userId),
  };
}
