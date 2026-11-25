import { readStore } from "./demo-store";
import { getEventById, getEvents } from "./events";
import { ServiceError, USE_MOCKS } from "./errors";
import type { Actor } from "./campus";
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
        // Короткий код появится вместе с проверкой входа (этап 6).
        shortCode: "",
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
