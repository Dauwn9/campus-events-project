import { mockEvents } from "@/lib/mocks/events";
import { ServiceError, USE_MOCKS } from "./errors";
import type { Event, EventInput } from "@/lib/validators/event";

export type EventFilters = {
  categoryId?: string;
  status?: Event["status"];
  from?: string;
  to?: string;
  search?: string;
};

let events: Event[] = [...mockEvents];

const notReady = (): never => {
  throw new ServiceError("INTERNAL", "Реальный сервис событий ещё не подключён");
};

export async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  if (!USE_MOCKS) return notReady();
  const { categoryId, status, from, to, search } = filters;
  const q = search?.trim().toLowerCase();

  return events
    .filter((e) => !categoryId || e.categoryId === categoryId)
    .filter((e) => !status || e.status === status)
    .filter((e) => !from || e.startsAt >= from)
    .filter((e) => !to || e.startsAt <= to)
    .filter(
      (e) =>
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getEventById(id: string): Promise<Event | null> {
  if (!USE_MOCKS) return notReady();
  return events.find((e) => e.id === id) ?? null;
}

export async function createEvent(input: EventInput): Promise<Event> {
  if (!USE_MOCKS) return notReady();
  const event: Event = {
    ...input,
    id: `evt-${Date.now()}`,
    registeredCount: 0,
  };
  events = [...events, event];
  return event;
}

export async function deleteEvent(id: string): Promise<boolean> {
  if (!USE_MOCKS) return notReady();
  const before = events.length;
  events = events.filter((e) => e.id !== id);
  return events.length < before;
}