// src/lib/services/organizer.ts
import { z } from "zod";
import { readStore } from "./demo-store";
import { getEventById, getEvents } from "./events";
import { ServiceError, USE_MOCKS } from "./errors";
import {
  checkInParticipant as checkInParticipantDemo,
  type Actor,
} from "./campus";
import { shortCodeFor, verifyQrToken } from "./tickets";
import { getPrisma } from "@/lib/prisma";
import type { Event } from "@/lib/validators/event";

export type OrganizerParticipant = {
  id: string;
  name: string;
  email: string;
  group: string;
  status: string;
  checkedInAt: string | null;
  shortCode: string;
};

export type ScannerEventSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registeredCount: number;
  location: string;
  checked: number;
};

/** Событие доступно организатору-владельцу и админу. */
async function getManagedEvent(actor: Actor, eventId: string): Promise<Event> {
  const event = await getEventById(eventId);
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (actor.role !== "ADMIN" && event.organizerId !== actor.id)
    throw new ServiceError(
      "FORBIDDEN",
      "Это событие принадлежит другому организатору.",
    );
  return event;
}

export async function getEventParticipants(
  actor: Actor,
  eventId: string,
): Promise<{ event: Event; participants: OrganizerParticipant[] }> {
  const event = await getManagedEvent(actor, eventId);
  if (!USE_MOCKS) {
    const registrations = await getPrisma().registration.findMany({
      where: { eventId },
      include: { user: { select: { name: true, email: true, group: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      event,
      participants: registrations.map((registration) => ({
        id: registration.id,
        name: registration.user.name,
        email: registration.user.email,
        group: registration.user.group ?? "",
        status: registration.status,
        checkedInAt: registration.checkedInAt?.toISOString() ?? null,
        shortCode:
          registration.status === "CONFIRMED"
            ? shortCodeFor(registration.id)
            : "",
      })),
    };
  }
  const store = readStore();
  return {
    event,
    participants: store.registrations
      .filter((registration) => registration.eventId === eventId)
      .map((registration) => {
        const person = store.users.find((u) => u.id === registration.userId);
        if (!person)
          throw new ServiceError(
            "INTERNAL",
            "Не удалось загрузить участника события.",
          );
        return {
          id: registration.id,
          name: person.name,
          email: person.email,
          group: person.group,
          status: registration.status,
          checkedInAt: registration.checkedInAt,
          shortCode: registration.shortCode,
        };
      }),
  };
}

/** Сколько подтверждённых входов на событиях организатора. */
export async function getOrganizerCheckInCount(organizerId: string) {
  if (!USE_MOCKS) {
    return getPrisma().registration.count({
      where: {
        checkedInAt: { not: null },
        event: { organizerId, archivedAt: null },
      },
    });
  }
  const events = await getEvents({ organizerId });
  const ids = new Set(events.map((event) => event.id));
  return readStore().registrations.filter(
    (registration) => ids.has(registration.eventId) && registration.checkedInAt,
  ).length;
}

/** Опубликованные события организатора для сканера, ближайшие — первыми. */
export async function getScannerEvents(
  organizerId: string,
): Promise<ScannerEventSummary[]> {
  const events = await getEvents({ organizerId, status: "PUBLISHED" });
  let checkedByEvent: Map<string, number>;
  if (!USE_MOCKS) {
    const counts = await getPrisma().registration.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: events.map((event) => event.id) },
        checkedInAt: { not: null },
      },
      _count: { _all: true },
    });
    checkedByEvent = new Map(
      counts.map((item) => [item.eventId, item._count._all]),
    );
  } else {
    checkedByEvent = new Map();
    for (const registration of readStore().registrations)
      if (registration.checkedInAt)
        checkedByEvent.set(
          registration.eventId,
          (checkedByEvent.get(registration.eventId) ?? 0) + 1,
        );
  }
  const now = Date.now();
  return events
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.startsAt) - now) -
        Math.abs(Date.parse(b.startsAt) - now),
    )
    .map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      registeredCount: event.registeredCount,
      location: event.location,
      checked: checkedByEvent.get(event.id) ?? 0,
    }));
}
// src/lib/services/organizer.ts (в конец файла)

export type CheckInResult = {
  already: boolean;
  name: string;
  /** Время отметки, ISO. */
  at: string;
};

const CHECK_IN_OPENS_BEFORE_MS = 60 * 60 * 1000;
const PRIORITY_AFTER_VISITS = 3;
const codeSchema = z.string().trim().min(4).max(500);

/** QR-токен проверяется по подписи, короткий код ищется среди CONFIRMED-записей события. */
async function findRegistrationIdByCode(
  eventId: string,
  code: string,
): Promise<string> {
  if (code.includes(".")) {
    const id = verifyQrToken(code);
    if (!id) throw new ServiceError("NOT_FOUND", "Запись не найдена.");
    return id;
  }
  const shortCode = code.toUpperCase();
  if (!/^[A-F0-9]{10}$/.test(shortCode))
    throw new ServiceError("NOT_FOUND", "Код не распознан.");
  const confirmed = await getPrisma().registration.findMany({
    where: { eventId, status: "CONFIRMED" },
    select: { id: true },
  });
  const match = confirmed.find((item) => shortCodeFor(item.id) === shortCode);
  if (!match) throw new ServiceError("NOT_FOUND", "Запись не найдена.");
  return match.id;
}

/**
 * Отметка входа по QR-токену или короткому коду.
 * Сканировать может организатор события, его волонтёр (EventStaff) или админ.
 */
export async function checkInParticipant(
  actor: Actor,
  eventId: string,
  rawCode: string,
): Promise<CheckInResult> {
  if (USE_MOCKS) return checkInParticipantDemo(actor, eventId, rawCode);

  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerId: true,
      status: true,
      archivedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");

  if (actor.role !== "ADMIN" && event.organizerId !== actor.id) {
    const staff = await prisma.eventStaff.findUnique({
      where: { eventId_userId: { eventId, userId: actor.id } },
      select: { userId: true },
    });
    if (!staff)
      throw new ServiceError(
        "FORBIDDEN",
        "Это событие принадлежит другому организатору.",
      );
  }

  if (event.archivedAt || event.status !== "PUBLISHED")
    throw new ServiceError(
      "FORBIDDEN",
      "Вход доступен только на опубликованное событие.",
    );

  const parsedCode = codeSchema.safeParse(rawCode);
  if (!parsedCode.success)
    throw new ServiceError("NOT_FOUND", "Код не распознан.");

  const registrationId = await findRegistrationIdByCode(
    eventId,
    parsedCode.data,
  );
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      userId: true,
      eventId: true,
      status: true,
      checkedInAt: true,
      user: { select: { name: true, blocked: true, blockedUntil: true } },
    },
  });
  if (
    !registration ||
    registration.eventId !== eventId ||
    registration.status !== "CONFIRMED"
  )
    throw new ServiceError("NOT_FOUND", "Запись не найдена на это событие.");

  const now = new Date();
  const { user } = registration;
  if (user.blocked && (!user.blockedUntil || user.blockedUntil > now))
    throw new ServiceError("FORBIDDEN", "Участник заблокирован.");

  // Повторный скан — не ошибка: показываем, когда человек уже был отмечен.
  if (registration.checkedInAt)
    return {
      already: true,
      name: user.name,
      at: registration.checkedInAt.toISOString(),
    };

  if (now.getTime() < event.startsAt.getTime() - CHECK_IN_OPENS_BEFORE_MS)
    throw new ServiceError(
      "NOT_OPEN_YET",
      "Вход ещё не открыт: за час до начала события.",
    );
  if (now.getTime() > event.endsAt.getTime())
    throw new ServiceError("NOT_OPEN_YET", "Вход уже закрыт.");

  return prisma.$transaction(async (transaction) => {
    // Условие checkedInAt = null защищает от двойной отметки при одновременных сканах:
    // второй запрос дождётся первого и увидит count = 0.
    const marked = await transaction.registration.updateMany({
      where: { id: registration.id, status: "CONFIRMED", checkedInAt: null },
      data: { checkedInAt: now, checkedInById: actor.id },
    });
    if (marked.count === 0) {
      const current = await transaction.registration.findUnique({
        where: { id: registration.id },
        select: { checkedInAt: true },
      });
      if (current?.checkedInAt)
        return {
          already: true,
          name: user.name,
          at: current.checkedInAt.toISOString(),
        };
      throw new ServiceError("NOT_FOUND", "Запись не найдена на это событие.");
    }

    await transaction.user.update({
      where: { id: registration.userId },
      data: { attendedCount: { increment: 1 } },
    });
    // После трёх посещений студент получает приоритетный статус.
    await transaction.user.updateMany({
      where: {
        id: registration.userId,
        attendedCount: { gte: PRIORITY_AFTER_VISITS },
        priorityStatus: "STANDARD",
      },
      data: { priorityStatus: "ACTIVE" },
    });

    return { already: false, name: user.name, at: now.toISOString() };
  });
}