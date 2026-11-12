import { requireRole } from "@/lib/auth";
import { readStore, type CampusAuditEntry } from "./demo-store";
import { isCampusUserBlocked } from "./campus";
import type { Event } from "@/lib/validators/event";

const isActiveEvent = (event: Event) => !event.archivedAt;

export async function getAdminModeration() {
  await requireRole("ADMIN");
  const store = readStore();
  const events = store.events.filter(isActiveEvent);
  return {
    pending: events.filter((event) => event.status === "PENDING"),
    decisions: events.filter((event) =>
      ["PUBLISHED", "REJECTED"].includes(event.status),
    ),
    categories: store.categories,
    organizers: store.users.map(({ id, name }) => ({ id, name })),
    counts: {
      pending: events.filter((event) => event.status === "PENDING").length,
      published: events.filter((event) => event.status === "PUBLISHED").length,
      rejected: events.filter((event) => event.status === "REJECTED").length,
    },
  };
}

export async function getAdminUsers() {
  await requireRole("ADMIN");
  return readStore().users.map(
    ({ id, name, email, role, group, blocked, blockedUntil }) => ({
      id,
      name,
      email,
      role,
      group,
      blocked: isCampusUserBlocked({ blocked, blockedUntil }),
      blockedUntil: blockedUntil ?? null,
    }),
  );
}

export async function getAdminAuditLog(): Promise<Array<CampusAuditEntry & { actorRole?: string | null }>> {
  await requireRole("ADMIN");
  const store = readStore();
  return store.auditLog.slice(-200).reverse().map((entry) => ({
    ...entry,
    actorRole: store.users.find((user) => user.id === entry.actorId)?.role ?? null,
  }));
}

export async function getAdminArchivedEvents() {
  await requireRole("ADMIN");
  const store = readStore();
  return store.events
    .filter((event) => Boolean(event.archivedAt))
    .sort((a, b) => b.archivedAt!.localeCompare(a.archivedAt!))
    .map((event) => ({
      ...event,
      categoryName:
        store.categories.find((category) => category.id === event.categoryId)
          ?.name ?? "Без категории",
      organizerName:
        store.users.find((user) => user.id === event.organizerId)?.name ??
        "Неизвестный организатор",
    }));
}

export async function getAdminOverview() {
  await requireRole("ADMIN");
  const store = readStore();
  return {
    totalEvents: store.events.filter(isActiveEvent).length,
    publishedEvents: store.events.filter(
      (e) => isActiveEvent(e) && e.status === "PUBLISHED",
    )
      .length,
    totalRegistrations: store.registrations.filter(
      (r) => r.status === "CONFIRMED",
    ).length,
    totalUsers: store.users.length,
    popularEvents: store.events
      .filter(isActiveEvent)
      .sort((a, b) => b.registeredCount - a.registeredCount)
      .slice(0, 5)
      .map(({ id, title, registeredCount }) => ({
        id,
        title,
        registeredCount,
      })),
  };
}
