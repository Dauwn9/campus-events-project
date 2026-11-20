import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { Event } from "@/lib/validators/event";
import type { EventListQuery } from "@/lib/validators/event-query";
import { eventInclude, toEventDto } from "./event-prisma";

export type EventFilters = {
  categoryId?: string;
  status?: Event["status"];
  from?: string;
  to?: string;
  search?: string;
  organizerId?: string;
};

function eventWhere(filters: EventFilters): Prisma.EventWhereInput {
  const search = filters.search?.trim();
  const startsAt =
    filters.from || filters.to
      ? {
          ...(filters.from ? { gte: new Date(filters.from) } : {}),
          ...(filters.to ? { lte: new Date(filters.to) } : {}),
        }
      : undefined;

  return {
    archivedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.organizerId ? { organizerId: filters.organizerId } : {}),
    ...(startsAt ? { startsAt } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function getEvents(filters: EventFilters = {}) {
  const events = await getPrisma().event.findMany({
    where: eventWhere(filters),
    include: eventInclude,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return events.map(toEventDto);
}

export async function getEventById(id: string) {
  const event = await getPrisma().event.findFirst({
    where: { id, archivedAt: null },
    include: eventInclude,
  });
  return event ? toEventDto(event) : null;
}

/** Публичный список: только PUBLISHED, с пагинацией на сервере. */
export async function listEvents(query: EventListQuery) {
  const where = eventWhere({
    status: "PUBLISHED",
    categoryId: query.categoryId,
    from: query.from,
    to: query.to,
    search: query.q,
  });
  const prisma = getPrisma();
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    items: events.map(toEventDto),
    total,
    page: query.page,
    limit: query.limit,
  };
}
