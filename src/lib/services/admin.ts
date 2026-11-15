import { requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
import { changeEventStatus, isCampusUserBlocked } from "./campus";
import type { Event } from "@/lib/validators/event";
import { getPrisma } from "@/lib/prisma";
import { ServiceError, USE_MOCKS } from "./errors";
import type { Role } from "@/lib/roles";

const isActiveEvent = (event: Event) => !event.archivedAt;

export async function getAdminModeration() {
  await requireRole("ADMIN");
  if (!USE_MOCKS) {
    const [events, categories, organizers] = await Promise.all([
      getPrisma().event.findMany({
        where: { status: { in: ["PENDING", "PUBLISHED", "REJECTED"] } },
        include: { _count: { select: { registrations: true } } },
        orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      }),
      getPrisma().category.findMany({ orderBy: { name: "asc" } }),
      getPrisma().user.findMany({
        where: { role: "ORGANIZER" },
        select: { id: true, name: true },
      }),
    ]);
    const mappedEvents = events.map((event) => ({
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
      rejectionReason: event.rejectionReason ?? undefined,
      imageUrl: event.coverUrl ?? undefined,
      registrationOpensAt:
        event.registrationOpensAt?.toISOString() ?? undefined,
      priorityWindowHours: event.priorityWindowHours,
      archivedAt: null,
    }));
    const pending = mappedEvents.filter((event) => event.status === "PENDING");
    const decisions = mappedEvents.filter(
      (event) => event.status === "PUBLISHED" || event.status === "REJECTED",
    );
    return {
      pending,
      decisions,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        archivedAt: category.archivedAt?.toISOString() ?? null,
      })),
      organizers,
      counts: {
        pending: pending.length,
        published: decisions.filter((event) => event.status === "PUBLISHED")
          .length,
        rejected: decisions.filter((event) => event.status === "REJECTED")
          .length,
      },
    };
  }
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

export async function moderateEvent(
  actor: { id: string; role: Role },
  eventId: string,
  decision: "approve" | "reject",
  reason = "",
) {
  await requireRole("ADMIN");
  if (USE_MOCKS) {
    return changeEventStatus(actor, eventId, decision, reason);
  }
  if (decision === "reject" && (reason.trim().length < 5 || reason.length > 1000)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Укажите причину отказа длиной от 5 до 1000 символов.",
    );
  }
  const result = await getPrisma().event.updateMany({
    where: { id: eventId, status: "PENDING" },
    data:
      decision === "approve"
        ? { status: "PUBLISHED", rejectionReason: null }
        : { status: "REJECTED", rejectionReason: reason.trim() },
  });
  if (result.count === 0) {
    const event = await getPrisma().event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    throw new ServiceError(
      "MODERATION_CLOSED",
      "Это событие уже обработано.",
    );
  }
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

export async function getAdminAuditLog() {
  await requireRole("ADMIN");
  return readStore().auditLog.slice(-200).reverse();
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
