import { requireRole } from "@/lib/auth";
import { readStore, type CampusAuditEntry } from "./demo-store";
import {
  changeEventStatus,
  recordCampusUserAudit,
} from "./campus";
import type { Event } from "@/lib/validators/event";
import { getPrisma } from "@/lib/prisma";
import { ServiceError, USE_MOCKS } from "./errors";
import { getArchivedEvents } from "./events";
import { z } from "zod";
import { toAppRole, type Role } from "@/lib/roles";

const adminUserUpdateSchema = z
  .object({
    role: z.enum(["STUDENT", "ORGANIZER", "ADMIN"]),
    blocked: z.boolean().optional(),
    banDuration: z.enum(["keep", "1d", "7d", "30d", "permanent"]).optional(),
  })
  .strict();

function isDatabaseUserBlocked(
  user: { blocked: boolean; blockedUntil: Date | null },
  now = Date.now(),
) {
  return (
    user.blocked &&
    (!user.blockedUntil || user.blockedUntil.getTime() > now)
  );
}

const isActiveEvent = (event: Event) => !event.archivedAt;

export async function getAdminModeration() {
  await requireRole("ADMIN");
  if (!USE_MOCKS) {
    const [events, categories, organizers] = await Promise.all([
      getPrisma().event.findMany({
        where: {
          archivedAt: null,
          status: { in: ["PENDING", "PUBLISHED", "REJECTED"] },
        },
        include: {
          _count: {
            select: { registrations: { where: { status: "CONFIRMED" } } },
          },
        },
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
  // Как и в демо-режиме: прошедшее событие опубликовать нельзя.
  const result = await getPrisma().event.updateMany({
    where: {
      id: eventId,
      status: "PENDING",
      archivedAt: null,
      ...(decision === "approve" ? { startsAt: { gt: new Date() } } : {}),
    },
    data:
      decision === "approve"
        ? { status: "PUBLISHED", rejectionReason: null }
        : { status: "REJECTED", rejectionReason: reason.trim() },
  });
  if (result.count === 0) {
    const event = await getPrisma().event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, archivedAt: true, startsAt: true },
    });
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (event.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );
    if (event.status === "PENDING" && event.startsAt <= new Date())
      throw new ServiceError("EVENT_PAST", "Нельзя опубликовать прошедшее событие.");
    throw new ServiceError(
      "MODERATION_CLOSED",
      "Это событие уже обработано.",
    );
  }
  return {
    id: eventId,
    status: decision === "approve" ? ("PUBLISHED" as const) : ("REJECTED" as const),
    rejectionReason: decision === "reject" ? reason.trim() : null,
  };
}

export async function getAdminUsers() {
  await requireRole("ADMIN");
  const users = await getPrisma().user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      group: true,
      blocked: true,
      blockedUntil: true,
    },
  });
  return users.map((user) => ({
    ...user,
    role: toAppRole(user.role),
    group: user.group ?? "",
    blocked: isDatabaseUserBlocked(user),
    blockedUntil: user.blockedUntil?.toISOString() ?? null,
  }));
}

export async function updateAdminUser(actor: {
  id: string;
  name: string;
  role: Role;
}, id: string, input: unknown) {
  const data = adminUserUpdateSchema.parse(input);
  const updated = await getPrisma().$transaction(
    async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          blocked: true,
          blockedUntil: true,
        },
      });
      if (!current) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
      if (actor.id === id && data.role !== current.role) {
        throw new ServiceError(
          "FORBIDDEN",
          "Нельзя изменить собственную роль.",
        );
      }
      if (
        current.role === "ADMIN" &&
        data.role !== "ADMIN" &&
        (await transaction.user.count({ where: { role: "ADMIN" } })) <= 1
      ) {
        throw new ServiceError(
          "FORBIDDEN",
          "Нельзя понизить последнего администратора.",
        );
      }

      const wasBlocked = isDatabaseUserBlocked(current);
      let blocked = current.blocked;
      let blockedUntil = current.blockedUntil;
      if (data.blocked === false) {
        blocked = false;
        blockedUntil = null;
      } else if (data.blocked === true) {
        blocked = true;
        const duration = data.banDuration ?? "keep";
        if (duration === "keep") {
          if (!wasBlocked) {
            throw new ServiceError(
              "FORBIDDEN",
              "Для новой блокировки выберите срок.",
            );
          }
        } else {
          blockedUntil =
            duration === "permanent"
              ? null
              : new Date(Date.now() + Number.parseInt(duration, 10) * 86400000);
        }
      }

      const user = await transaction.user.update({
        where: { id },
        data: { role: data.role, blocked, blockedUntil },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          blocked: true,
          blockedUntil: true,
        },
      });
      return {
        user,
        previousRole: current.role,
        wasBlocked,
        blocked: isDatabaseUserBlocked(user),
        previousBlockedUntil: current.blockedUntil,
        roleChanged: current.role !== user.role,
        blockedUntilChanged:
          current.blockedUntil?.getTime() !== user.blockedUntil?.getTime(),
      };
    },
    { isolationLevel: "Serializable" },
  );

  // Журнал изменений пока есть только в демо-хранилище (см. getAdminAuditLog);
  // в режиме базы его запись упала бы уже после сохранения роли.
  if (USE_MOCKS) recordCampusUserAudit(actor, updated.user, [
    ...(updated.roleChanged
      ? [
          {
            field: "role",
            oldValue: updated.previousRole,
            newValue: data.role,
          },
        ]
      : []),
    ...(updated.wasBlocked !== updated.blocked
      ? [
          {
            field: "blocked",
            oldValue: updated.wasBlocked,
            newValue: updated.blocked,
          },
        ]
      : []),
    ...(updated.blockedUntilChanged
      ? [
          {
            field: "blockedUntil",
            oldValue: updated.previousBlockedUntil,
            newValue: updated.user.blockedUntil,
          },
        ]
      : []),
  ]);

  return {
    id: updated.user.id,
    role: updated.user.role,
    blocked: updated.blocked,
    blockedUntil: updated.user.blockedUntil?.toISOString() ?? null,
    roleChanged: updated.roleChanged,
  };
}

export async function getAdminAuditLog(): Promise<Array<CampusAuditEntry & { actorRole?: string | null }>> {
  await requireRole("ADMIN");
  // Журнал изменений пока хранится только в демо-хранилище: таблица
  // для него появится отдельной миграцией. В режиме базы журнал пуст.
  if (!USE_MOCKS) return [];
  const store = readStore();
  return store.auditLog.slice(-200).reverse().map((entry) => ({
    ...entry,
    actorRole: store.users.find((user) => user.id === entry.actorId)?.role ?? null,
  }));
}

export async function getAdminArchivedEvents() {
  await requireRole("ADMIN");
  if (!USE_MOCKS) {
    const events = await getArchivedEvents();
    const [categories, organizers] = await Promise.all([
      getPrisma().category.findMany({
        where: { id: { in: events.map((event) => event.categoryId) } },
        select: { id: true, name: true },
      }),
      getPrisma().user.findMany({
        where: { id: { in: events.map((event) => event.organizerId) } },
        select: { id: true, name: true },
      }),
    ]);
    return events.map((event) => ({
      ...event,
      categoryName:
        categories.find((category) => category.id === event.categoryId)
          ?.name ?? "Без категории",
      organizerName:
        organizers.find((user) => user.id === event.organizerId)?.name ??
        "Неизвестный организатор",
    }));
  }
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
  if (!USE_MOCKS) {
    const prisma = getPrisma();
    const [totalEvents, publishedEvents, totalRegistrations, totalUsers, events] =
      await Promise.all([
        prisma.event.count(),
        prisma.event.count({ where: { status: "PUBLISHED", archivedAt: null } }),
        prisma.registration.count({ where: { status: "CONFIRMED" } }),
        prisma.user.count(),
        prisma.event.findMany({
          where: { status: "PUBLISHED", archivedAt: null },
          select: { id: true, title: true },
        }),
      ]);
    const registrationCounts = events.length
      ? await prisma.registration.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: events.map((event) => event.id) },
            status: "CONFIRMED",
          },
          _count: { _all: true },
        })
      : [];
    const countByEvent = new Map(
      registrationCounts.map((item) => [item.eventId, item._count._all]),
    );

    return {
      totalEvents,
      publishedEvents,
      totalRegistrations,
      totalUsers,
      popularEvents: events
        .map((event) => ({
          id: event.id,
          title: event.title,
          registeredCount: countByEvent.get(event.id) ?? 0,
        }))
        .sort((a, b) => b.registeredCount - a.registeredCount)
        .slice(0, 5),
    };
  }

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
