import { readStore } from "./demo-store";
import type { Event } from "@/lib/validators/event";
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
