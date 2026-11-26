import {
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import {
  changeStore,
  readStore,
  qrToken,
  hashPassword,
  verifyPassword,
  type CampusStore,
  type CampusUser,
  type CampusAuditEntry,
} from "./demo-store";
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";
import { EventStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { eventInclude, toEventDto } from "./event-prisma";
import { toggleFavoriteForActor } from "./favorites";
import { profileInputSchema } from "@/lib/validators/profile";
import { studentGroupSchema } from "@/lib/validators/student-group";
import {
  eventInputSchema,
  type Event,
  type EventInput,
} from "@/lib/validators/event";
import type { Role } from "@/lib/roles";

export type Actor = {
  id: string;
  role: Role;
  name?: string;
  blocked?: boolean;
  blockedUntil?: Date | string | null;
};
export function isCampusUserBlocked(
  user: Pick<CampusUser, "blocked" | "blockedUntil">,
  now = Date.now(),
) {
  if (!user.blocked) return false;
  if (!user.blockedUntil) return true;
  const expiresAt = Date.parse(user.blockedUntil);
  return !Number.isFinite(expiresAt) || expiresAt > now;
}

function isPrismaUserBlocked(
  user: { blocked: boolean; blockedUntil: Date | null },
  now = new Date(),
) {
  return user.blocked && (!user.blockedUntil || user.blockedUntil > now);
}

function auditValue(value: unknown, store: CampusStore, field: string) {
  if (value === undefined || value === null || value === "") return "—";
  if (field === "categoryId") {
    return store.categories.find((category) => category.id === value)?.name ??
      String(value);
  }
  if (field === "status") {
    const labels: Record<string, string> = {
      DRAFT: "Черновик",
      PENDING: "На модерации",
      REJECTED: "Отклонено",
      PUBLISHED: "Опубликовано",
      CANCELLED: "Отменено",
      FINISHED: "Завершено",
    };
    return labels[String(value)] ?? String(value);
  }
  if (field === "role") {
    const labels: Record<string, string> = {
      STUDENT: "Студент",
      ORGANIZER: "Организатор",
      ADMIN: "Администратор",
    };
    return labels[String(value)] ?? String(value);
  }
  if (field === "blocked") return value ? "Заблокирован" : "Активен";
  return String(value);
}

function recordAuditChanges(
  store: CampusStore,
  actor: Actor & { name?: string },
  entity: Pick<CampusAuditEntry, "entityType" | "entityId" | "entityLabel">,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  const actorName =
    actor.name ?? store.users.find((user) => user.id === actor.id)?.name ?? actor.id;
  const occurredAt = new Date().toISOString();
  for (const change of changes) {
    store.auditLog.push({
      id: randomUUID(),
      occurredAt,
      actorId: actor.id,
      actorName,
      ...entity,
      field: change.field,
      oldValue: auditValue(change.oldValue, store, change.field),
      newValue: auditValue(change.newValue, store, change.field),
    });
  }
  store.auditLog = store.auditLog.slice(-1000);
}

function prismaAuditValue(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return "—";
  if (value instanceof Date) return value.toISOString();
  if (field === "status") {
    const labels: Record<string, string> = {
      DRAFT: "Черновик",
      PENDING: "На модерации",
      REJECTED: "Отклонено",
      PUBLISHED: "Опубликовано",
      CANCELLED: "Отменено",
      FINISHED: "Завершено",
    };
    return labels[String(value)] ?? String(value);
  }
  if (field === "role") {
    const labels: Record<string, string> = {
      STUDENT: "Студент",
      ORGANIZER: "Организатор",
      ADMIN: "Администратор",
    };
    return labels[String(value)] ?? String(value);
  }
  if (field === "blocked") return value ? "Заблокирован" : "Активен";
  return String(value);
}

async function recordPrismaAudit(
  actor: Actor,
  entity: Pick<CampusAuditEntry, "entityType" | "entityId" | "entityLabel">,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  if (!changes.length) return;
  const actorName =
    actor.name ??
    (await getPrisma().user.findUnique({
      where: { id: actor.id },
      select: { name: true },
    }))?.name ??
    actor.id;
  await getPrisma().auditEntry.createMany({
    data: changes.map((change) => ({
      actorId: actor.id,
      actorName,
      ...entity,
      field: change.field,
      oldValue: prismaAuditValue(change.oldValue, change.field),
      newValue: prismaAuditValue(change.newValue, change.field),
    })),
  });
}

export function recordCampusUserAudit(
  actor: Actor,
  user: Pick<CampusUser, "id" | "name" | "email">,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  if (!USE_MOCKS) {
    return recordPrismaAudit(
      actor,
      {
        entityType: "USER",
        entityId: user.id,
        entityLabel: `${user.name} (${user.email})`,
      },
      changes,
    );
  }
  changeStore((store) =>
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "USER",
        entityId: user.id,
        entityLabel: `${user.name} (${user.email})`,
      },
      changes,
    ),
  );
}

function notifyEventParticipants(
  store: CampusStore,
  event: Event,
  kind: "EVENT_CANCELLED" | "EVENT_UPDATED",
  message: string,
) {
  const recipientIds = new Set(
    store.registrations
      .filter(
        (registration) =>
          registration.eventId === event.id &&
          (registration.status === "CONFIRMED" ||
            registration.status === "WAITLIST"),
      )
      .map((registration) => registration.userId),
  );
  const createdAt = new Date().toISOString();
  for (const userId of recipientIds) {
    store.notifications.push({
      id: randomUUID(),
      userId,
      eventId: event.id,
      kind,
      title:
        kind === "EVENT_CANCELLED"
          ? `Событие отменено: ${event.title}`
          : `Событие изменилось: ${event.title}`,
      message,
      createdAt,
      readAt: null,
    });
  }
}

export function assertRole(
  actor: Actor,
  roles: Role[],
  store?: CampusStore,
) {
  // TODO: Remove the legacy store argument after mock-backed services are migrated.
  void store;
  const blockedUntil =
    actor.blockedUntil instanceof Date
      ? actor.blockedUntil.getTime()
      : actor.blockedUntil
        ? Date.parse(actor.blockedUntil)
        : null;
  const blocked =
    actor.blocked === true &&
    (blockedUntil === null ||
      !Number.isFinite(blockedUntil) ||
      blockedUntil > Date.now());
  if (
    !roles.includes(actor.role) ||
    !actor.id ||
    blocked
  )
    throw new ServiceError("FORBIDDEN", "Это действие недоступно вашей роли.");
  return actor;
}
export function ownedEvent(store: CampusStore, actor: Actor, eventId: string) {
  assertRole(actor, ["ORGANIZER", "ADMIN"], store);
  const event = store.events.find((item) => item.id === eventId);
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (actor.role !== "ADMIN" && event.organizerId !== actor.id)
    throw new ServiceError(
      "FORBIDDEN",
      "Это событие принадлежит другому организатору.",
    );
  return event;
}

export function getStudentPriorityStatus(
  store: CampusStore,
  userId: string,
): "STANDARD" | "ACTIVE" {
  // TODO: Read a real student's priority status when registration data moves off the demo store.
  const user = store.users.find((item) => item.id === userId);
  if (!user) return "STANDARD";
  const visits = store.registrations.filter(
    (registration) => registration.userId === userId && registration.checkedInAt,
  ).length;
  return user.priorityStatus === "ACTIVE" || visits >= 3 ? "ACTIVE" : "STANDARD";
}

export function isPriorityEventMember(
  store: CampusStore,
  userId: string,
  eventId: string,
) {
  const event = store.events.find((item) => item.id === eventId);
  return Boolean(event?.priorityMembers?.includes(userId));
}

export async function archiveAdminEvent(actor: Actor, eventId: string) {
  assertRole(actor, ["ADMIN"]);
  const event = await getPrisma().$transaction(async (transaction) => {
    const current = await transaction.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    });
    if (!current) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (current.archivedAt)
      throw new ServiceError("FORBIDDEN", "Событие уже находится в архиве.");
    return toEventDto(
      await transaction.event.update({
        where: { id: eventId },
        data: { archivedAt: new Date() },
        include: eventInclude,
      }),
    );
  });

  if (USE_MOCKS) {
    changeStore((store) =>
      recordAuditChanges(
        store,
        actor,
        {
          entityType: "EVENT",
          entityId: event.id,
          entityLabel: `${event.title} (${event.id})`,
        },
        [{ field: "archivedAt", oldValue: null, newValue: event.archivedAt }],
      ),
    );
  } else {
    await recordPrismaAudit(
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      [{ field: "archivedAt", oldValue: null, newValue: event.archivedAt }],
    );
  }
  return event;
}

export async function restoreAdminEvent(actor: Actor, eventId: string) {
  assertRole(actor, ["ADMIN"]);
  const event = await getPrisma().$transaction(async (transaction) => {
    const current = await transaction.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    });
    if (!current) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (!current.archivedAt)
      throw new ServiceError("FORBIDDEN", "Событие не находится в архиве.");

    const category = await transaction.category.findFirst({
      where: { id: current.categoryId, archivedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new ServiceError(
        "FORBIDDEN",
        "Сначала восстановите категорию события.",
      );
    }

    return toEventDto(
      await transaction.event.update({
        where: { id: eventId },
        data: { archivedAt: null },
        include: eventInclude,
      }),
    );
  });

  if (USE_MOCKS) {
    changeStore((store) =>
      recordAuditChanges(
        store,
        actor,
        {
          entityType: "EVENT",
          entityId: event.id,
          entityLabel: `${event.title} (${event.id})`,
        },
        [{ field: "archivedAt", oldValue: "В архиве", newValue: null }],
      ),
    );
  } else {
    await recordPrismaAudit(
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      [{ field: "archivedAt", oldValue: "В архиве", newValue: null }],
    );
  }
  return event;
}

export async function saveCampusEvent(actor: Actor, input: EventInput, id?: string) {
  const parsed = eventInputSchema.parse(input);
  assertRole(actor, id ? ["ORGANIZER", "ADMIN"] : ["ORGANIZER"]);

  const result = await getPrisma().$transaction(async (transaction) => {
    const category = await transaction.category.findFirst({
      where: { id: parsed.categoryId, archivedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new ServiceError("NOT_FOUND", "Выберите существующую категорию.");
    }
    if (new Date(parsed.startsAt) <= new Date())
      throw new ServiceError(
        "EVENT_PAST",
        "Дата начала должна быть в будущем.",
      );

    const previousRecord = id
      ? await transaction.event.findUnique({
          where: { id },
          include: eventInclude,
        })
      : null;
    if (id && !previousRecord)
      throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (
      previousRecord &&
      actor.role !== "ADMIN" &&
      previousRecord.organizerId !== actor.id
    )
      throw new ServiceError(
        "FORBIDDEN",
        "Это событие принадлежит другому организатору.",
      );
    if (previousRecord?.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );

    const previous = previousRecord ? toEventDto(previousRecord) : undefined;
    if (previousRecord) {
      const mockRegistrations = USE_MOCKS
        ? readStore().registrations.filter(
            (registration) =>
              registration.eventId === id &&
              registration.status === "CONFIRMED",
          )
        : [];
      if (
        parsed.capacity <
        previousRecord._count.registrations + mockRegistrations.length
      )
        throw new ServiceError(
          "EVENT_FULL",
          "Вместимость не может быть меньше числа записавшихся.",
        );

      const checkedInCount = await transaction.registration.count({
        where: { eventId: id, checkedInAt: { not: null } },
      });
      const hasMockCheckIns =
        USE_MOCKS &&
        readStore().registrations.some(
          (registration) => registration.eventId === id && registration.checkedInAt,
        );
      if (checkedInCount > 0 || hasMockCheckIns)
        throw new ServiceError(
          "FORBIDDEN",
          "Нельзя изменять событие после начала отметки входа.",
        );
    }

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

    const eventData = {
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      coverUrl: parsed.imageUrl ?? null,
      startsAt: new Date(parsed.startsAt),
      endsAt: new Date(parsed.endsAt),
      capacity: parsed.capacity,
      status:
        parsed.status === "DRAFT" ? EventStatus.DRAFT : EventStatus.PENDING,
      rejectionReason: null,
      registrationOpensAt: parsed.registrationOpensAt
        ? new Date(parsed.registrationOpensAt)
        : null,
      priorityWindowHours: parsed.priorityWindowHours ?? 0,
      organizerId: previousRecord?.organizerId ?? actor.id,
      categoryId: parsed.categoryId,
    };
    const savedRecord = previousRecord
      ? await transaction.event.update({
          where: { id: previousRecord.id },
          data: eventData,
          include: eventInclude,
        })
      : await transaction.event.create({
          data: { id: `evt-${randomUUID()}`, ...eventData },
          include: eventInclude,
        });

    return { previous, event: toEventDto(savedRecord) };
  });

  if (USE_MOCKS) {
    const changedDetails = result.previous?.status === "PUBLISHED"
      ? [
          result.previous.title !== result.event.title ? "название" : null,
          result.previous.startsAt !== result.event.startsAt ||
          result.previous.endsAt !== result.event.endsAt
            ? "дату и время"
            : null,
          result.previous.location !== result.event.location ? "место" : null,
        ].filter((detail): detail is string => detail !== null)
      : [];
    const auditFields = [
      "title",
      "description",
      "location",
      "startsAt",
      "endsAt",
      "capacity",
      "categoryId",
      "registrationOpensAt",
      "priorityWindowHours",
      "status",
      "rejectionReason",
    ] as const;

    changeStore((store) => {
      if (changedDetails.length > 0) {
        notifyEventParticipants(
          store,
          result.event,
          "EVENT_UPDATED",
          `Организатор изменил ${changedDetails.join(", ")}. Проверьте обновлённую информацию на странице события.`,
        );
      }
      recordAuditChanges(
        store,
        actor,
        {
          entityType: "EVENT",
          entityId: result.event.id,
          entityLabel: `${result.event.title} (${result.event.id})`,
        },
        auditFields.flatMap((field) => {
          const oldValue = result.previous?.[field];
          const newValue = result.event[field];
          return result.previous && oldValue === newValue
            ? []
            : [{ field, oldValue, newValue }];
        }),
      );
    });
  } else {
    const changedDetails = result.previous?.status === "PUBLISHED"
      ? [
          result.previous.title !== result.event.title ? "название" : null,
          result.previous.startsAt !== result.event.startsAt ||
          result.previous.endsAt !== result.event.endsAt
            ? "дату и время"
            : null,
          result.previous.location !== result.event.location ? "место" : null,
        ].filter((detail): detail is string => detail !== null)
      : [];
    if (changedDetails.length > 0) {
      const registrations = await getPrisma().registration.findMany({
        where: {
          eventId: result.event.id,
          status: { in: ["CONFIRMED", "WAITLIST"] },
        },
        select: { userId: true },
      });
      if (registrations.length) {
        await getPrisma().notification.createMany({
          data: registrations.map(({ userId }) => ({
            userId,
            eventId: result.event.id,
            kind: "EVENT_UPDATED",
            title: `Событие изменилось: ${result.event.title}`,
            message: `Организатор изменил ${changedDetails.join(", ")}. Проверьте обновлённую информацию на странице события.`,
          })),
        });
      }
    }
    const auditFields = [
      "title",
      "description",
      "location",
      "startsAt",
      "endsAt",
      "capacity",
      "categoryId",
      "registrationOpensAt",
      "priorityWindowHours",
      "status",
      "rejectionReason",
    ] as const;
    await recordPrismaAudit(
      actor,
      {
        entityType: "EVENT",
        entityId: result.event.id,
        entityLabel: `${result.event.title} (${result.event.id})`,
      },
      auditFields.flatMap((field) => {
        const oldValue = result.previous?.[field];
        const newValue = result.event[field];
        return result.previous && oldValue === newValue
          ? []
          : [{ field, oldValue, newValue }];
      }),
    );
  }

  return result.event;
}
export async function changeEventStatus(
  actor: Actor,
  eventId: string,
  action: "submit" | "approve" | "reject" | "cancel" | "delete",
  reason = "",
) {
  assertRole(
    actor,
    action === "approve" || action === "reject"
      ? ["ADMIN"]
      : ["ORGANIZER", "ADMIN"],
  );

  const result = await getPrisma().$transaction(async (transaction) => {
    const record = await transaction.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    });
    if (!record) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (actor.role !== "ADMIN" && record.organizerId !== actor.id)
      throw new ServiceError(
        "FORBIDDEN",
        "Это событие принадлежит другому организатору.",
      );
    if (record.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );

    const previous = toEventDto(record);
    if (action === "approve" || action === "reject") {
      if (record.status !== "PENDING")
        throw new ServiceError(
          "MODERATION_CLOSED",
          "Событие уже обработано или не отправлено на модерацию.",
        );
      if (action === "reject" && (reason.trim().length < 5 || reason.length > 1000))
        throw new ServiceError(
          "FORBIDDEN",
          "Укажите причину отказа длиной от 5 до 1000 символов.",
        );
      if (action === "approve" && record.startsAt <= new Date())
        throw new ServiceError(
          "EVENT_PAST",
          "Нельзя опубликовать прошедшее событие.",
        );
      const updated = await transaction.event.update({
        where: { id: eventId },
        data:
          action === "approve"
            ? { status: EventStatus.PUBLISHED, rejectionReason: null }
            : {
                status: EventStatus.REJECTED,
                rejectionReason: reason.trim().slice(0, 1000),
              },
        include: eventInclude,
      });
      return { previous, event: toEventDto(updated), deleted: false };
    }

    if (action === "submit") {
      if (record.status !== "DRAFT" && record.status !== "REJECTED")
        throw new ServiceError(
          "FORBIDDEN",
          "Событие уже отправлено или опубликовано.",
        );
      if (record.startsAt <= new Date())
        throw new ServiceError(
          "EVENT_PAST",
          "Обновите дату события перед отправкой.",
        );
      const updated = await transaction.event.update({
        where: { id: eventId },
        data: { status: EventStatus.PENDING, rejectionReason: null },
        include: eventInclude,
      });
      return { previous, event: toEventDto(updated), deleted: false };
    }

    if (action === "delete") {
      const databaseRegistrations = await transaction.registration.count({
        where: { eventId, status: { not: "CANCELLED" } },
      });
      const mockRegistrations = USE_MOCKS
        ? readStore().registrations.some(
            (registration) =>
              registration.eventId === eventId &&
              registration.status !== "CANCELLED",
          )
        : false;
      if (databaseRegistrations > 0 || mockRegistrations)
        throw new ServiceError(
          "FORBIDDEN",
          "Есть участники. Отмените событие, чтобы сохранить их историю.",
        );
      await transaction.event.delete({ where: { id: eventId } });
      return { previous, event: null, deleted: true };
    }

    if (record.status === "CANCELLED") {
      throw new ServiceError("FORBIDDEN", "Событие уже отменено.");
    }
    const updated = await transaction.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED },
      include: eventInclude,
    });
    const registrations = await transaction.registration.findMany({
      where: {
        eventId,
        status: { in: ["CONFIRMED", "WAITLIST"] },
      },
      select: { userId: true },
    });
    if (registrations.length) {
      await transaction.notification.createMany({
        data: registrations.map(({ userId }) => ({
          userId,
          eventId,
          kind: "EVENT_CANCELLED",
          title: `Событие отменено: ${record.title}`,
          message: "Организатор отменил событие. Ваша регистрация сохранена в истории.",
        })),
      });
    }
    await transaction.registration.updateMany({
      where: {
        eventId,
        status: { in: ["CONFIRMED", "WAITLIST"] },
        checkedInAt: null,
      },
      data: { status: "CANCELLED", qrToken: null },
    });
    return { previous, event: toEventDto(updated), deleted: false };
  });

  if (USE_MOCKS) {
    changeStore((store) => {
      if (result.deleted) {
        store.events = store.events.filter((event) => event.id !== eventId);
        store.comments = store.comments.filter(
          (comment) => comment.eventId !== eventId,
        );
        store.registrations = store.registrations.filter(
          (registration) => registration.eventId !== eventId,
        );
      } else if (action === "cancel" && result.event) {
        notifyEventParticipants(
          store,
          result.event,
          "EVENT_CANCELLED",
          "Организатор отменил событие. Ваша регистрация сохранена в истории.",
        );
        const mockEvent = store.events.find((event) => event.id === eventId);
        if (mockEvent) mockEvent.status = "CANCELLED";
        for (const registration of store.registrations.filter(
          (item) => item.eventId === eventId && !item.checkedInAt,
        )) {
          registration.status = "CANCELLED";
          registration.qrToken = null;
        }
        if (mockEvent) {
          mockEvent.registeredCount = store.registrations.filter(
            (registration) =>
              registration.eventId === eventId &&
              registration.status === "CONFIRMED",
          ).length;
        }
      }

      const changes = result.deleted
        ? [{ field: "deleted", oldValue: result.previous.title, newValue: "Удалено" }]
        : [
            ...(result.previous.status !== result.event?.status
              ? [{
                  field: "status",
                  oldValue: result.previous.status,
                  newValue: result.event?.status,
                }]
              : []),
            ...(result.previous.rejectionReason !== result.event?.rejectionReason
              ? [{
                  field: "rejectionReason",
                  oldValue: result.previous.rejectionReason,
                  newValue: result.event?.rejectionReason,
                }]
              : []),
          ];
      recordAuditChanges(
        store,
        actor,
        {
          entityType: "EVENT",
          entityId: result.previous.id,
          entityLabel: `${result.previous.title} (${result.previous.id})`,
        },
        changes,
      );
    });
  } else {
    const changes = result.deleted
      ? [{ field: "deleted", oldValue: result.previous.title, newValue: "Удалено" }]
      : [
          ...(result.previous.status !== result.event?.status
            ? [{
                field: "status",
                oldValue: result.previous.status,
                newValue: result.event?.status,
              }]
            : []),
          ...(result.previous.rejectionReason !== result.event?.rejectionReason
            ? [{
                field: "rejectionReason",
                oldValue: result.previous.rejectionReason,
                newValue: result.event?.rejectionReason,
              }]
            : []),
        ];
    await recordPrismaAudit(
      actor,
      {
        entityType: "EVENT",
        entityId: result.previous.id,
        entityLabel: `${result.previous.title} (${result.previous.id})`,
      },
      changes,
    );
  }

  return result.event ?? result.previous;
}
async function registerStudentWithPrisma(actor: Actor, eventId: string) {
  assertRole(actor, ["STUDENT"]);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const event = await transaction.event.findFirst({
      where: { id: eventId, archivedAt: null, status: "PUBLISHED" },
    });
    if (!event)
      throw new ServiceError("NOT_FOUND", "Событие недоступно для записи.");
    const now = new Date();
    if (event.startsAt <= now)
      throw new ServiceError("EVENT_PAST", "Запись закрыта: событие уже началось.");
    const current = await transaction.registration.findUnique({
      where: { userId_eventId: { userId: actor.id, eventId } },
    });
    if (current && current.status !== "CANCELLED")
      throw new ServiceError("ALREADY_REGISTERED", "Вы уже записаны на это событие.");
    if (event.registrationOpensAt && event.registrationOpensAt > now)
      throw new ServiceError("NOT_OPEN_YET", "Запись ещё не открылась.");

    const [user, visits, priorityMember, confirmedCount] = await Promise.all([
      transaction.user.findUnique({
        where: { id: actor.id },
        select: { priorityStatus: true },
      }),
      transaction.registration.count({
        where: { userId: actor.id, checkedInAt: { not: null } },
      }),
      transaction.eventPriorityMember.findUnique({
        where: { eventId_userId: { eventId, userId: actor.id } },
        select: { userId: true },
      }),
      transaction.registration.count({
        where: { eventId, status: "CONFIRMED" },
      }),
    ]);
    const priorityDeadline =
      event.registrationOpensAt && event.priorityWindowHours
        ? event.registrationOpensAt.getTime() + event.priorityWindowHours * 3600000
        : null;
    if (
      priorityDeadline &&
      now.getTime() < priorityDeadline &&
      user?.priorityStatus !== "ACTIVE" &&
      visits < 3 &&
      !priorityMember
    )
      throw new ServiceError(
        "NOT_OPEN_YET",
        "Пока действует приоритетная запись для активных студентов и участников списка организатора.",
      );

    const status = confirmedCount < event.capacity ? "CONFIRMED" : "WAITLIST";
    const registration = current
      ? await transaction.registration.update({
          where: { id: current.id },
          data: {
            status,
            createdAt: now,
            qrToken: status === "CONFIRMED" ? randomBytes(32).toString("base64url") : null,
            shortCode: randomBytes(5).toString("hex").toUpperCase(),
            checkedInAt: null,
            checkedInById: null,
          },
        })
      : await transaction.registration.create({
          data: {
            userId: actor.id,
            eventId,
            status,
            qrToken: status === "CONFIRMED" ? randomBytes(32).toString("base64url") : null,
            shortCode: randomBytes(5).toString("hex").toUpperCase(),
          },
        });
    return registration;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function registerStudent(actor: Actor, eventId: string) {
  if (!USE_MOCKS) return registerStudentWithPrisma(actor, eventId);
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    const event = store.events.find((e) => e.id === eventId);
    if (!event || event.archivedAt || event.status !== "PUBLISHED")
      throw new ServiceError("NOT_FOUND", "Событие недоступно для записи.");
    if (new Date(event.startsAt) <= new Date())
      throw new ServiceError(
        "EVENT_PAST",
        "Запись закрыта: событие уже началось.",
      );
    const current = store.registrations.find(
      (r) => r.userId === actor.id && r.eventId === eventId,
    );
    if (current && current.status !== "CANCELLED")
      throw new ServiceError(
        "ALREADY_REGISTERED",
        "Вы уже записаны на это событие.",
      );
    if (
      event.registrationOpensAt &&
      new Date(event.registrationOpensAt) > new Date()
    )
      throw new ServiceError("NOT_OPEN_YET", "Запись ещё не открылась.");
    const priorityOpenAt =
      event.registrationOpensAt && event.priorityWindowHours
        ? Date.parse(event.registrationOpensAt) +
          event.priorityWindowHours * 3600000
        : null;
    const isActive = getStudentPriorityStatus(store, actor.id) === "ACTIVE";
    const isPriorityMember = isPriorityEventMember(store, actor.id, event.id);
    if (
      event.registrationOpensAt &&
      Date.parse(event.registrationOpensAt) > Date.now()
    )
      throw new ServiceError("NOT_OPEN_YET", "Запись ещё не открылась.");
    if (
      priorityOpenAt &&
      Date.now() < priorityOpenAt &&
      !isActive &&
      !isPriorityMember
    )
      throw new ServiceError(
        "NOT_OPEN_YET",
        "Пока действует приоритетная запись для активных студентов и участников списка организатора.",
      );
    const id = current?.id ?? `reg-${randomUUID()}`;
    const status =
      event.registeredCount < event.capacity
        ? ("CONFIRMED" as const)
        : ("WAITLIST" as const);
    const registration = {
      id,
      userId: actor.id,
      eventId,
      status,
      createdAt: new Date().toISOString(),
      qrToken: status === "CONFIRMED" ? qrToken(store, id) : null,
      shortCode: randomBytes(5).toString("hex").toUpperCase(),
      checkedInAt: null,
      checkedInById: null,
    };
    store.registrations = [
      ...store.registrations.filter((r) => r.id !== id),
      registration,
    ];
    if (status === "CONFIRMED") event.registeredCount++;
    return registration;
  });
}
async function cancelStudentRegistrationWithPrisma(
  actor: Actor,
  registrationId: string,
) {
  assertRole(actor, ["STUDENT"]);
  return getPrisma().$transaction(async (transaction) => {
    const registration = await transaction.registration.findFirst({
      where: { id: registrationId, userId: actor.id },
      include: { event: true },
    });
    if (!registration)
      throw new ServiceError("NOT_FOUND", "Ваша регистрация не найдена.");
    if (registration.checkedInAt)
      throw new ServiceError("FORBIDDEN", "Вход уже отмечен. Отменить посещение нельзя.");
    if (registration.event.startsAt <= new Date())
      throw new ServiceError("EVENT_PAST", "После начала события запись нельзя отменить.");
    if (registration.status === "CANCELLED") return registration;

    const cancelled = await transaction.registration.update({
      where: { id: registration.id },
      data: { status: "CANCELLED", qrToken: null },
    });
    if (registration.status === "CONFIRMED") {
      const now = new Date();
      const next = await transaction.registration.findFirst({
        where: {
          eventId: registration.eventId,
          status: "WAITLIST",
          user: {
            OR: [
              { blocked: false },
              { blocked: true, blockedUntil: { lte: now } },
            ],
          },
        },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await transaction.registration.update({
          where: { id: next.id },
          data: {
            status: "CONFIRMED",
            qrToken: randomBytes(32).toString("base64url"),
          },
        });
      }
    }
    return cancelled;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function cancelStudentRegistration(
  actor: Actor,
  registrationId: string,
) {
  if (!USE_MOCKS)
    return cancelStudentRegistrationWithPrisma(actor, registrationId);
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    const registration = store.registrations.find(
      (r) => r.id === registrationId && r.userId === actor.id,
    );
    if (!registration)
      throw new ServiceError("NOT_FOUND", "Ваша регистрация не найдена.");
    if (registration.checkedInAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Вход уже отмечен. Отменить посещение нельзя.",
      );
    const event = store.events.find((e) => e.id === registration.eventId)!;
    if (new Date(event.startsAt) <= new Date())
      throw new ServiceError(
        "EVENT_PAST",
        "После начала события запись нельзя отменить.",
      );
    const hadSeat = registration.status === "CONFIRMED";
    registration.status = "CANCELLED";
    registration.qrToken = null;
    if (hadSeat) {
      event.registeredCount = Math.max(0, event.registeredCount - 1);
      const next = store.registrations
        .filter(
          (r) =>
            r.eventId === event.id &&
            r.status === "WAITLIST" &&
            !store.users.some(
              (u) => u.id === r.userId && isCampusUserBlocked(u),
            ),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (next) {
        next.status = "CONFIRMED";
        next.qrToken = qrToken(store, next.id);
        event.registeredCount++;
      }
    }
    return registration;
  });
}
async function checkInParticipantWithPrisma(
  actor: Actor,
  eventId: string,
  rawCode: string,
) {
  assertRole(actor, ["ORGANIZER", "ADMIN"]);
  const parsedCode = z.string().trim().min(4).max(500).safeParse(rawCode);
  if (!parsedCode.success)
    throw new ServiceError("NOT_FOUND", "Код не распознан.");
  const prisma = getPrisma();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      status: true,
      archivedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
  if (actor.role !== "ADMIN" && event.organizerId !== actor.id)
    throw new ServiceError("FORBIDDEN", "Это событие принадлежит другому организатору.");
  if (event.archivedAt || event.status !== "PUBLISHED")
    throw new ServiceError("FORBIDDEN", "Вход доступен только на опубликованное событие.");

  const code = parsedCode.data;
  const registration = await prisma.registration.findFirst({
    where: {
      eventId,
      status: "CONFIRMED",
      OR: [{ shortCode: code.toUpperCase() }, { qrToken: code }],
    },
    include: { user: { select: { name: true, blocked: true, blockedUntil: true } } },
  });
  if (!registration)
    throw new ServiceError("NOT_FOUND", "Запись не найдена на это событие.");
  if (
    registration.user.blocked &&
    (!registration.user.blockedUntil || registration.user.blockedUntil > new Date())
  )
    throw new ServiceError("FORBIDDEN", "Участник заблокирован.");
  if (registration.checkedInAt)
    return {
      already: true,
      name: registration.user.name,
      at: registration.checkedInAt.toISOString(),
    };
  const now = new Date();
  if (now.getTime() < event.startsAt.getTime() - 3600000)
    throw new ServiceError("NOT_OPEN_YET", "Вход ещё не открыт: за час до начала события.");
  if (now > event.endsAt)
    throw new ServiceError("NOT_OPEN_YET", "Вход уже закрыт.");
  const updated = await prisma.registration.updateMany({
    where: { id: registration.id, checkedInAt: null },
    data: { checkedInAt: now, checkedInById: actor.id },
  });
  if (updated.count === 0) {
    const checkedIn = await prisma.registration.findUniqueOrThrow({
      where: { id: registration.id },
      select: { checkedInAt: true },
    });
    return {
      already: true,
      name: registration.user.name,
      at: checkedIn.checkedInAt!.toISOString(),
    };
  }
  return { already: false, name: registration.user.name, at: now.toISOString() };
}

export function checkInParticipant(
  actor: Actor,
  eventId: string,
  rawCode: string,
) {
  if (!USE_MOCKS)
    return checkInParticipantWithPrisma(actor, eventId, rawCode);
  return changeStore((store) => {
    const event = ownedEvent(store, actor, eventId);
    if (event.archivedAt || event.status !== "PUBLISHED")
      throw new ServiceError(
        "FORBIDDEN",
        "Вход доступен только на опубликованное событие.",
      );
    const parsedCode = z.string().trim().min(4).max(500).safeParse(rawCode);
    if (!parsedCode.success)
      throw new ServiceError("NOT_FOUND", "Код не распознан.");
    const code = parsedCode.data;
    const registration = store.registrations.find(
      (r) => r.shortCode === code.toUpperCase() || r.qrToken === code,
    );
    if (!registration)
      throw new ServiceError("NOT_FOUND", "Запись не найдена.");
    if (registration.eventId !== eventId || registration.status !== "CONFIRMED")
      throw new ServiceError("NOT_FOUND", "Запись не найдена на это событие.");
    const participant = store.users.find((u) => u.id === registration.userId);
    if (participant && isCampusUserBlocked(participant))
      throw new ServiceError("FORBIDDEN", "Участник заблокирован.");
    // TODO: Resolve real participant names from Prisma after registrations migrate.
    const participantName = participant?.name ?? "Участник";
    if (registration.qrToken === code) {
      const expected = Buffer.from(qrToken(store, registration.id));
      const actual = Buffer.from(code);
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw new ServiceError("FORBIDDEN", "Код не распознан.");
    }
    if (registration.checkedInAt)
      return {
        already: true,
        name: participantName,
        at: registration.checkedInAt,
      };
    const now = Date.now();
    if (now < Date.parse(event.startsAt) - 3600000)
      throw new ServiceError(
        "NOT_OPEN_YET",
        "Вход ещё не открыт: за час до начала события.",
      );
    if (now > Date.parse(event.endsAt))
      throw new ServiceError("NOT_OPEN_YET", "Вход уже закрыт.");
    registration.checkedInAt = new Date().toISOString();
    registration.checkedInById = actor.id;
    return {
      already: false,
      name: participantName,
      at: registration.checkedInAt,
    };
  });
}
export async function toggleStudentFavorite(actor: Actor, eventId: string) {
  return toggleFavoriteForActor(actor, eventId);
}
export function updateCampusUser(
  actor: Actor,
  id: string,
  role: unknown,
  blocked: boolean,
  banDuration = "permanent",
) {
  if (!USE_MOCKS) {
    assertRole(actor, ["ADMIN"]);
    const validated = z.enum(["STUDENT", "ORGANIZER", "ADMIN"]).parse(role);
    const duration = z.enum(["keep", "1d", "7d", "30d", "permanent"]).parse(banDuration);
    return (async () => {
      const prisma = getPrisma();
      const updated = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findUnique({
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
        if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
        if (user.id === actor.id)
          throw new ServiceError("FORBIDDEN", "Нельзя изменить собственные права.");
        if (
          user.role === "ADMIN" &&
          validated !== "ADMIN" &&
          (await transaction.user.count({ where: { role: "ADMIN" } })) <= 1
        )
          throw new ServiceError("FORBIDDEN", "Нельзя понизить последнего администратора.");
        const wasBlocked = isPrismaUserBlocked(user);
        let blockedUntil = user.blockedUntil;
        if (!blocked) blockedUntil = null;
        else if (duration !== "keep") {
          blockedUntil =
            duration === "permanent"
              ? null
              : new Date(Date.now() + Number.parseInt(duration, 10) * 86400000);
        } else if (!wasBlocked) {
          throw new ServiceError("FORBIDDEN", "Для новой блокировки выберите срок.");
        }
        const saved = await transaction.user.update({
          where: { id },
          data: { role: validated, blocked, blockedUntil },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            blocked: true,
            blockedUntil: true,
          },
        });
        return { user: saved, wasBlocked, oldRole: user.role, oldBlockedUntil: user.blockedUntil };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await recordCampusUserAudit(actor, updated.user, [
        ...(updated.oldRole !== updated.user.role
          ? [{ field: "role", oldValue: updated.oldRole, newValue: updated.user.role }]
          : []),
        ...(updated.wasBlocked !== isPrismaUserBlocked(updated.user)
          ? [{ field: "blocked", oldValue: updated.wasBlocked, newValue: isPrismaUserBlocked(updated.user) }]
          : []),
        ...(updated.oldBlockedUntil?.getTime() !== updated.user.blockedUntil?.getTime()
          ? [{ field: "blockedUntil", oldValue: updated.oldBlockedUntil, newValue: updated.user.blockedUntil }]
          : []),
      ]);
      return {
        id: updated.user.id,
        role: updated.user.role,
        blocked: isPrismaUserBlocked(updated.user),
        roleChanged: updated.oldRole !== updated.user.role,
      };
    })();
  }
  return changeStore((store) => {
    assertRole(actor, ["ADMIN"], store);
    const user = store.users.find((u) => u.id === id);
    if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
    const validated = z.enum(["STUDENT", "ORGANIZER", "ADMIN"]).parse(role);
    if (["student-demo", "org-2", "admin-demo"].includes(id))
      throw new ServiceError(
        "FORBIDDEN",
        "Базовые демонстрационные роли закреплены. Измените другого пользователя.",
      );
    if (user.id === actor.id)
      throw new ServiceError("FORBIDDEN", "Нельзя изменить собственные права.");
    const duration = z
      .enum(["keep", "1d", "7d", "30d", "permanent"])
      .parse(banDuration);
    const wasBlocked = isCampusUserBlocked(user);
    const previousRole = user.role;
    const previousBlockedUntil = user.blockedUntil ?? null;
    user.role = validated;
    user.blocked = blocked;
    if (!blocked) {
      user.blockedUntil = null;
    } else if (duration !== "keep") {
      user.blockedUntil =
        duration === "permanent"
          ? null
          : new Date(
              Date.now() +
                Number.parseInt(duration, 10) * 86400000,
            ).toISOString();
    } else if (!wasBlocked) {
      throw new ServiceError(
        "FORBIDDEN",
        "Для новой блокировки выберите срок.",
      );
    }
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "USER",
        entityId: user.id,
        entityLabel: `${user.name} (${user.email})`,
      },
      [
        ...(previousRole !== user.role
          ? [{ field: "role", oldValue: previousRole, newValue: user.role }]
          : []),
        ...(wasBlocked !== blocked
          ? [
              {
                field: "blocked",
                oldValue: wasBlocked,
                newValue: blocked,
              },
            ]
          : []),
        ...(previousBlockedUntil !== (user.blockedUntil ?? null)
          ? [
              {
                field: "blockedUntil",
                oldValue: previousBlockedUntil,
                newValue: user.blockedUntil ?? null,
              },
            ]
          : []),
      ],
    );
    return {
      id: user.id,
      role: user.role,
      blocked: user.blocked,
      roleChanged: previousRole !== user.role,
    };
  });
}
export function updateStudentProfile(
  actor: Actor,
  input: {
    name: string;
    currentPassword?: string;
    password?: string;
    passwordConfirmation?: string;
  },
) {
  if (!USE_MOCKS) {
    assertRole(actor, ["STUDENT"]);
    const parsed = profileInputSchema.parse({
      name: input.name,
      currentPassword: input.currentPassword ?? "",
      password: input.password ?? "",
      passwordConfirmation: input.passwordConfirmation ?? "",
    });
    return (async () => {
      const requestHeaders = new Headers(await headers());
      const { updateProfileName, changeProfilePassword } = await import("@/lib/profile");
      await updateProfileName(requestHeaders, parsed.name);
      if (parsed.password) {
        await changeProfilePassword(
          requestHeaders,
          parsed.currentPassword ?? "",
          parsed.password,
        );
      }
    })();
  }
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    const user = store.users.find((item) => item.id === actor.id);
    const parsed = profileInputSchema.parse({
      name: input.name,
      currentPassword: input.currentPassword ?? "",
      password: input.password ?? "",
      passwordConfirmation: input.passwordConfirmation ?? "",
    });
    if (parsed.password) {
      if (
        !user ||
        !verifyPassword(parsed.currentPassword ?? "", user.passwordHash)
      )
        throw new ServiceError("UNAUTHORIZED", "Текущий пароль неверен.");
      user.passwordHash = hashPassword(parsed.password);
    }
    // TODO: Profile persistence for Better Auth users belongs in the Prisma profile service.
    if (user) user.name = parsed.name;
    for (const comment of store.comments.filter((c) => c.userId === actor.id))
      comment.userName = parsed.name;
  });
}
export function updateStudentGroup(actor: Actor, id: string, group: unknown) {
  if (!USE_MOCKS) {
    assertRole(actor, ["ADMIN"]);
    const parsedGroup = studentGroupSchema.parse(group);
    return (async () => {
      const updated = await getPrisma().user.updateMany({
        where: { id, role: "STUDENT" },
        data: { group: parsedGroup },
      });
      if (!updated.count) {
        const user = await getPrisma().user.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
        throw new ServiceError("FORBIDDEN", "Учебную группу можно изменить только студенту.");
      }
      return { id, group: parsedGroup };
    })();
  }
  return changeStore((store) => {
    assertRole(actor, ["ADMIN"], store);
    const user = store.users.find((item) => item.id === id);
    if (!user) throw new ServiceError("NOT_FOUND", "Пользователь не найден.");
    if (user.role !== "STUDENT") {
      throw new ServiceError(
        "FORBIDDEN",
        "Учебную группу можно изменить только студенту.",
      );
    }
    user.group = studentGroupSchema.parse(group);
    return { id: user.id, group: user.group };
  });
}
