import { readStore } from "./demo-store";
import {
  archiveAdminEvent,
  changeEventStatus,
  restoreAdminEvent,
  saveCampusEvent,
  type Actor,
} from "./campus";
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  eventInputSchema,
  type Event,
  type EventInput,
} from "@/lib/validators/event";
import type { EventListQuery } from "@/lib/validators/event-query";

export type EventFilters = {
  categoryId?: string;
  status?: Event["status"];
  from?: string;
  to?: string;
  search?: string;
  organizerId?: string;
};

export type EventOperation = "submit" | "cancel" | "delete";

// ============================================================
// Prisma: преобразование записи базы в контракт Event
// ============================================================

const eventInclude = {
  _count: {
    select: { registrations: { where: { status: "CONFIRMED" as const } } },
  },
} satisfies Prisma.EventInclude;

type DatabaseEvent = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

function toEvent(event: DatabaseEvent): Event {
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
    registrationOpensAt: event.registrationOpensAt?.toISOString() ?? undefined,
    priorityWindowHours: event.priorityWindowHours,
  };
}

function databaseWhere(filters: EventFilters): Prisma.EventWhereInput {
  const search = filters.search?.trim();
  return {
    archivedAt: null,
    status: filters.status,
    categoryId: filters.categoryId,
    organizerId: filters.organizerId,
    startsAt:
      filters.from || filters.to
        ? {
            gte: filters.from ? new Date(filters.from) : undefined,
            lte: filters.to ? new Date(filters.to) : undefined,
          }
        : undefined,
    OR: search
      ? [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

// ============================================================
// Чтение
// ============================================================

export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  if (!USE_MOCKS) {
    const events = await getPrisma().event.findMany({
      where: databaseWhere(filters),
      include: eventInclude,
      orderBy: { startsAt: "asc" },
    });
    return events.map(toEvent);
  }
  const q = filters.search?.trim().toLowerCase();
  return readStore()
    .events.filter(
      (e) =>
        !e.archivedAt &&
        (!filters.status || e.status === filters.status) &&
        (!filters.categoryId || e.categoryId === filters.categoryId) &&
        (!filters.organizerId || e.organizerId === filters.organizerId) &&
        (!filters.from || e.startsAt >= filters.from) &&
        (!filters.to || e.startsAt <= filters.to) &&
        (!q || `${e.title} ${e.description}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getEventById(id: string): Promise<Event | null> {
  if (!USE_MOCKS) {
    const event = await getPrisma().event.findFirst({
      where: { id, archivedAt: null },
      include: eventInclude,
    });
    return event ? toEvent(event) : null;
  }
  return readStore().events.find((e) => e.id === id && !e.archivedAt) ?? null;
}

/** Публичный список: только PUBLISHED, с пагинацией на сервере. */
export async function listEvents(query: EventListQuery) {
  const filters: EventFilters = {
    status: "PUBLISHED",
    categoryId: query.categoryId,
    from: query.from,
    to: query.to,
    search: query.q,
  };
  if (!USE_MOCKS) {
    const where = databaseWhere(filters);
    const [items, total] = await getPrisma().$transaction([
      getPrisma().event.findMany({
        where,
        include: eventInclude,
        orderBy: { startsAt: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      getPrisma().event.count({ where }),
    ]);
    return {
      items: items.map(toEvent),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  const all = await getEvents(filters);
  const start = (query.page - 1) * query.limit;
  return {
    items: all.slice(start, start + query.limit),
    total: all.length,
    page: query.page,
    limit: query.limit,
  };
}

// ============================================================
// Изменение (организатор / админ)
// ============================================================

async function findOwnedEvent(
  transaction: Prisma.TransactionClient,
  actor: Actor,
  id: string,
) {
  const event = await transaction.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (actor.role !== "ADMIN" && event.organizerId !== actor.id)
    throw new ServiceError(
      "FORBIDDEN",
      "Это событие принадлежит другому организатору.",
    );
  return event;
}

function assertActorRole(actor: Actor, roles: Actor["role"][]) {
  if (!roles.includes(actor.role))
    throw new ServiceError("FORBIDDEN", "Это действие недоступно вашей роли.");
}

/**
 * Создать (без id) или изменить своё событие. После сохранения событие
 * снова уходит на модерацию (PENDING) или остаётся черновиком (DRAFT).
 */
export async function saveEvent(
  actor: Actor,
  input: EventInput,
  id?: string,
): Promise<Event> {
  if (USE_MOCKS) return saveCampusEvent(actor, input, id);
  assertActorRole(actor, ["ORGANIZER"]);
  const parsed = eventInputSchema.parse(input);

  if (new Date(parsed.startsAt) <= new Date())
    throw new ServiceError("EVENT_PAST", "Дата начала должна быть в будущем.");
  if (
    parsed.registrationOpensAt &&
    new Date(parsed.registrationOpensAt) > new Date(parsed.startsAt)
  )
    throw new ServiceError(
      "FORBIDDEN",
      "Запись должна открываться до начала события.",
    );
  if (parsed.priorityWindowHours && !parsed.registrationOpensAt)
    throw new ServiceError(
      "FORBIDDEN",
      "Для приоритетного окна задайте дату открытия записи.",
    );

  return getPrisma().$transaction(async (transaction) => {
    const category = await transaction.category.findFirst({
      where: { id: parsed.categoryId, archivedAt: null },
      select: { id: true },
    });
    if (!category)
      throw new ServiceError("NOT_FOUND", "Выберите существующую категорию.");

    const data = {
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      coverUrl: parsed.imageUrl ?? null,
      startsAt: new Date(parsed.startsAt),
      endsAt: new Date(parsed.endsAt),
      capacity: parsed.capacity,
      categoryId: parsed.categoryId,
      registrationOpensAt: parsed.registrationOpensAt
        ? new Date(parsed.registrationOpensAt)
        : null,
      priorityWindowHours: parsed.priorityWindowHours ?? 0,
      status:
        parsed.status === "DRAFT" ? ("DRAFT" as const) : ("PENDING" as const),
      rejectionReason: null,
    };

    if (!id) {
      const created = await transaction.event.create({
        data: { ...data, organizerId: actor.id },
        include: eventInclude,
      });
      return toEvent(created);
    }

    const previous = await findOwnedEvent(transaction, actor, id);
    if (previous.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );
    if (previous.status === "CANCELLED")
      throw new ServiceError("FORBIDDEN", "Отменённое событие изменить нельзя.");
    if (parsed.capacity < previous._count.registrations)
      throw new ServiceError(
        "EVENT_FULL",
        "Вместимость не может быть меньше числа записавшихся.",
      );
    const checkedIn = await transaction.registration.count({
      where: { eventId: id, checkedInAt: { not: null } },
    });
    if (checkedIn > 0)
      throw new ServiceError(
        "FORBIDDEN",
        "Нельзя изменять событие после начала отметки входа.",
      );

    const updated = await transaction.event.update({
      where: { id },
      data,
      include: eventInclude,
    });
    return toEvent(updated);
  });
}

/** Действия организатора: отправить на модерацию, отменить, удалить. */
export async function changeEvent(
  actor: Actor,
  id: string,
  operation: EventOperation,
): Promise<Event | null> {
  if (USE_MOCKS) return changeEventStatus(actor, id, operation);
  assertActorRole(actor, ["ORGANIZER", "ADMIN"]);

  return getPrisma().$transaction(async (transaction) => {
    const event = await findOwnedEvent(transaction, actor, id);
    if (event.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );

    if (operation === "submit") {
      if (event.status !== "DRAFT" && event.status !== "REJECTED")
        throw new ServiceError(
          "FORBIDDEN",
          "Событие уже отправлено или опубликовано.",
        );
      if (event.startsAt <= new Date())
        throw new ServiceError(
          "EVENT_PAST",
          "Обновите дату события перед отправкой.",
        );
      const updated = await transaction.event.update({
        where: { id },
        data: { status: "PENDING", rejectionReason: null },
        include: eventInclude,
      });
      return toEvent(updated);
    }

    if (operation === "delete") {
      const active = await transaction.registration.count({
        where: { eventId: id, status: { not: "CANCELLED" } },
      });
      if (active > 0)
        throw new ServiceError(
          "FORBIDDEN",
          "Есть участники. Отмените событие, чтобы сохранить их историю.",
        );
      await transaction.event.delete({ where: { id } });
      return null;
    }

    // cancel: регистрации не удаляем, только снимаем активные места.
    if (event.status === "CANCELLED")
      throw new ServiceError("FORBIDDEN", "Событие уже отменено.");
    await transaction.registration.updateMany({
      where: { eventId: id, checkedInAt: null },
      data: { status: "CANCELLED", qrToken: null },
    });
    const updated = await transaction.event.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: eventInclude,
    });
    return toEvent(updated);
  });
}

/** Архив (только админ): скрывает событие из афиши, регистрации остаются. */
export async function archiveEvent(actor: Actor, id: string) {
  if (USE_MOCKS) return archiveAdminEvent(actor, id);
  assertActorRole(actor, ["ADMIN"]);
  const event = await getPrisma().event.findUnique({
    where: { id },
    select: { archivedAt: true },
  });
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (event.archivedAt)
    throw new ServiceError("FORBIDDEN", "Событие уже находится в архиве.");
  const updated = await getPrisma().event.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: eventInclude,
  });
  return toEvent(updated);
}

export async function restoreEvent(actor: Actor, id: string) {
  if (USE_MOCKS) return restoreAdminEvent(actor, id);
  assertActorRole(actor, ["ADMIN"]);
  const event = await getPrisma().event.findUnique({
    where: { id },
    select: { archivedAt: true, category: { select: { archivedAt: true } } },
  });
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (!event.archivedAt)
    throw new ServiceError("FORBIDDEN", "Событие не находится в архиве.");
  if (event.category.archivedAt)
    throw new ServiceError(
      "FORBIDDEN",
      "Сначала восстановите категорию события.",
    );
  const updated = await getPrisma().event.update({
    where: { id },
    data: { archivedAt: null },
    include: eventInclude,
  });
  return toEvent(updated);
}

/** Архивные события для админки. */
export async function getArchivedEvents(): Promise<Event[]> {
  if (!USE_MOCKS) {
    const events = await getPrisma().event.findMany({
      where: { archivedAt: { not: null } },
      include: eventInclude,
      orderBy: { archivedAt: "desc" },
    });
    return events.map(toEvent);
  }
  return readStore()
    .events.filter((event) => Boolean(event.archivedAt))
    .sort((a, b) => b.archivedAt!.localeCompare(a.archivedAt!));
}
