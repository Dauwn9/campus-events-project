import { requireRole } from "@/lib/auth";
import { readStore, type CampusAuditEntry } from "./demo-store";
import {
  changeEventStatus,
  recordCampusUserAudit,
} from "./campus";
import type { Event } from "@/lib/validators/event";
import { getPrisma } from "@/lib/prisma";
import { ServiceError } from "./errors";
import { z } from "zod";
import { toAppRole, type Role } from "@/lib/roles";
import { eventInclude, toEventDto } from "./event-prisma";

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
  const [events, categories, organizers] = await Promise.all([
    getPrisma().event.findMany({
      where: {
        archivedAt: null,
        status: { in: ["PENDING", "PUBLISHED", "REJECTED"] },
      },
      include: eventInclude,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    }),
    getPrisma().category.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    }),
    getPrisma().user.findMany({
      where: { role: "ORGANIZER" },
      select: { id: true, name: true },
    }),
  ]);
  const mappedEvents = events.map(toEventDto);
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

export async function moderateEvent(
  actor: { id: string; role: Role },
  eventId: string,
  decision: "approve" | "reject",
  reason = "",
) {
  await requireRole("ADMIN");
  if (
    decision === "reject" &&
    (reason.trim().length < 5 || reason.length > 1000)
  ) {
    throw new ServiceError(
      "FORBIDDEN",
      "Укажите причину отказа длиной от 5 до 1000 символов.",
    );
  }
  return changeEventStatus(actor, eventId, decision, reason);
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

  recordCampusUserAudit(actor, updated.user, [
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
  const store = readStore();
  return store.auditLog.slice(-200).reverse().map((entry) => ({
    ...entry,
    // TODO: Resolve audit actor roles from Better Auth users after audit storage migrates.
    actorRole: store.users.find((user) => user.id === entry.actorId)?.role ?? null,
  }));
}

export async function getAdminArchivedEvents() {
  await requireRole("ADMIN");
  const events = await getPrisma().event.findMany({
    where: { archivedAt: { not: null } },
    include: {
      ...eventInclude,
      category: { select: { name: true } },
      organizer: { select: { name: true } },
    },
    orderBy: { archivedAt: "desc" },
  });
  return events.map((event) => ({
    ...toEventDto(event),
    categoryName: event.category.name,
    organizerName: event.organizer.name,
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
