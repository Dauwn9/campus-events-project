import { readStore } from "./demo-store";
import type { Event } from "@/lib/validators/event";
import type { EventListQuery } from "@/lib/validators/event-query";
export type EventFilters = {
  categoryId?: string;
  status?: Event["status"];
  from?: string;
  to?: string;
  search?: string;
};
export async function getEvents(filters: EventFilters = {}) {
  const q = filters.search?.trim().toLowerCase();
  return readStore()
    .events.filter(
      (e) =>
        !e.archivedAt &&
        (!filters.status || e.status === filters.status) &&
        (!filters.categoryId || e.categoryId === filters.categoryId) &&
        (!filters.from || e.startsAt >= filters.from) &&
        (!filters.to || e.startsAt <= filters.to) &&
        (!q || `${e.title} ${e.description}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export async function getEventById(id: string) {
  return readStore().events.find((e) => e.id === id && !e.archivedAt) ?? null;
}
/** Публичный список: только PUBLISHED, с пагинацией на сервере. */
export async function listEvents(query: EventListQuery) {
  const all = await getEvents({
    status: "PUBLISHED",
    categoryId: query.categoryId,
    from: query.from,
    to: query.to,
    search: query.q,
  });
  const start = (query.page - 1) * query.limit;
  return {
    items: all.slice(start, start + query.limit),
    total: all.length,
    page: query.page,
    limit: query.limit,
  };
}
