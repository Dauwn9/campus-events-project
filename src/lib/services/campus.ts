import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
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
import { ServiceError } from "./errors";
import { profileInputSchema } from "@/lib/validators/profile";
import { studentGroupSchema } from "@/lib/validators/student-group";
import { eventInputSchema, type EventInput } from "@/lib/validators/event";
import type { Role } from "@/lib/roles";

export type Actor = { id: string; role: Role };
export function isCampusUserBlocked(
  user: Pick<CampusUser, "blocked" | "blockedUntil">,
  now = Date.now(),
) {
  if (!user.blocked) return false;
  if (!user.blockedUntil) return true;
  const expiresAt = Date.parse(user.blockedUntil);
  return !Number.isFinite(expiresAt) || expiresAt > now;
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
  actor: Actor,
  entity: Pick<CampusAuditEntry, "entityType" | "entityId" | "entityLabel">,
  changes: { field: string; oldValue: unknown; newValue: unknown }[],
) {
  const actorName =
    store.users.find((user) => user.id === actor.id)?.name ?? actor.id;
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

export function assertRole(actor: Actor, roles: Role[], store = readStore()) {
  const user = store.users.find((item) => item.id === actor.id);
  if (
    !roles.includes(actor.role) ||
    !user ||
    isCampusUserBlocked(user) ||
    user.role !== actor.role
  )
    throw new ServiceError("FORBIDDEN", "Это действие недоступно вашей роли.");
  return user;
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

export function archiveAdminEvent(actor: Actor, eventId: string) {
  return changeStore((store) => {
    assertRole(actor, ["ADMIN"], store);
    const event = store.events.find((item) => item.id === eventId);
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (event.archivedAt)
      throw new ServiceError("FORBIDDEN", "Событие уже находится в архиве.");
    event.archivedAt = new Date().toISOString();
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      [{ field: "archivedAt", oldValue: null, newValue: event.archivedAt }],
    );
    return event;
  });
}

export function restoreAdminEvent(actor: Actor, eventId: string) {
  return changeStore((store) => {
    assertRole(actor, ["ADMIN"], store);
    const event = store.events.find((item) => item.id === eventId);
    if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено.");
    if (!event.archivedAt)
      throw new ServiceError("FORBIDDEN", "Событие не находится в архиве.");
    if (
      store.categories.some(
        (category) =>
          category.id === event.categoryId && category.archivedAt,
      )
    )
      throw new ServiceError(
        "FORBIDDEN",
        "Сначала восстановите категорию события.",
      );
    const archivedAt = event.archivedAt;
    event.archivedAt = null;
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      [{ field: "archivedAt", oldValue: archivedAt, newValue: null }],
    );
    return event;
  });
}

export function saveCampusEvent(actor: Actor, input: EventInput, id?: string) {
  const parsed = eventInputSchema.parse(input);
  return changeStore((store) => {
    assertRole(actor, ["ORGANIZER"], store);
    if (
      !store.categories.some(
        (category) =>
          category.id === parsed.categoryId && !category.archivedAt,
      )
    )
      throw new ServiceError("NOT_FOUND", "Выберите существующую категорию.");
    const previous = id ? ownedEvent(store, actor, id) : undefined;
    if (previous?.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );
    if (new Date(parsed.startsAt) <= new Date())
      throw new ServiceError(
        "EVENT_PAST",
        "Дата начала должна быть в будущем.",
      );
    if (previous && parsed.capacity < previous.registeredCount)
      throw new ServiceError(
        "EVENT_FULL",
        "Вместимость не может быть меньше числа записавшихся.",
      );
    if (
      previous &&
      store.registrations.some((r) => r.eventId === id && r.checkedInAt)
    )
      throw new ServiceError(
        "FORBIDDEN",
        "Нельзя изменять событие после начала отметки входа.",
      );
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
    const event = {
      ...parsed,
      id: previous?.id ?? `evt-${randomUUID()}`,
      archivedAt: previous?.archivedAt ?? null,
      organizerId: actor.id,
      registeredCount: previous?.registeredCount ?? 0,
      priorityMembers: previous?.priorityMembers ?? [],
      status:
        parsed.status === "DRAFT" ? ("DRAFT" as const) : ("PENDING" as const),
      rejectionReason: undefined,
    };
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
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      auditFields.flatMap((field) => {
        const oldValue = previous?.[field];
        const newValue = event[field];
        return previous && oldValue === newValue
          ? []
          : [{ field, oldValue, newValue }];
      }),
    );
    store.events = [...store.events.filter((e) => e.id !== event.id), event];
    return event;
  });
}
export function changeEventStatus(
  actor: Actor,
  eventId: string,
  action: "submit" | "approve" | "reject" | "cancel" | "delete",
  reason = "",
) {
  return changeStore((store) => {
    const event = ownedEvent(store, actor, eventId);
    if (event.archivedAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Событие находится в архиве. Сначала восстановите его.",
      );
    const previousStatus = event.status;
    const previousReason = event.rejectionReason;
    if (action === "approve" || action === "reject") {
      assertRole(actor, ["ADMIN"], store);
      if (event.status !== "PENDING")
        throw new ServiceError(
          "FORBIDDEN",
          "Событие уже обработано или не отправлено на модерацию.",
        );
      if (action === "reject" && reason.trim().length < 5)
        throw new ServiceError(
          "FORBIDDEN",
          "Укажите причину отказа: минимум 5 символов.",
        );
      if (action === "approve" && new Date(event.startsAt) <= new Date())
        throw new ServiceError(
          "EVENT_PAST",
          "Нельзя опубликовать прошедшее событие.",
        );
      event.status = action === "approve" ? "PUBLISHED" : "REJECTED";
      event.rejectionReason =
        action === "reject" ? reason.trim().slice(0, 1000) : undefined;
    } else if (action === "submit") {
      if (!["DRAFT", "REJECTED"].includes(event.status))
        throw new ServiceError(
          "FORBIDDEN",
          "Событие уже отправлено или опубликовано.",
        );
      if (new Date(event.startsAt) <= new Date())
        throw new ServiceError(
          "EVENT_PAST",
          "Обновите дату события перед отправкой.",
        );
      event.status = "PENDING";
      event.rejectionReason = undefined;
    } else if (action === "delete") {
      if (
        store.registrations.some(
          (r) => r.eventId === eventId && r.status !== "CANCELLED",
        )
      )
        throw new ServiceError(
          "FORBIDDEN",
          "Есть участники. Отмените событие, чтобы сохранить их историю.",
        );
      recordAuditChanges(
        store,
        actor,
        {
          entityType: "EVENT",
          entityId: event.id,
          entityLabel: `${event.title} (${event.id})`,
        },
        [{ field: "deleted", oldValue: event.title, newValue: "Удалено" }],
      );
      store.events = store.events.filter((e) => e.id !== eventId);
      store.favorites = store.favorites.filter((f) => f.eventId !== eventId);
      store.comments = store.comments.filter((c) => c.eventId !== eventId);
      store.registrations = store.registrations.filter(
        (r) => r.eventId !== eventId,
      );
    } else {
      event.status = "CANCELLED";
      for (const r of store.registrations.filter(
        (r) => r.eventId === eventId && !r.checkedInAt,
      )) {
        r.status = "CANCELLED";
        r.qrToken = null;
      }
      event.registeredCount = store.registrations.filter(
        (r) => r.eventId === eventId && r.status === "CONFIRMED",
      ).length;
    }
    recordAuditChanges(
      store,
      actor,
      {
        entityType: "EVENT",
        entityId: event.id,
        entityLabel: `${event.title} (${event.id})`,
      },
      [
        ...(previousStatus !== event.status
          ? [
              {
                field: "status",
                oldValue: previousStatus,
                newValue: event.status,
              },
            ]
          : []),
        ...(previousReason !== event.rejectionReason
          ? [
              {
                field: "rejectionReason",
                oldValue: previousReason,
                newValue: event.rejectionReason,
              },
            ]
          : []),
      ],
    );
    return event;
  });
}
export function registerStudent(actor: Actor, eventId: string) {
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
export function cancelStudentRegistration(
  actor: Actor,
  registrationId: string,
) {
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
export function checkInParticipant(
  actor: Actor,
  eventId: string,
  rawCode: string,
) {
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
    const participant = store.users.find((u) => u.id === registration.userId)!;
    if (isCampusUserBlocked(participant))
      throw new ServiceError("FORBIDDEN", "Участник заблокирован.");
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
        name: participant.name,
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
      name: participant.name,
      at: registration.checkedInAt,
    };
  });
}
export function toggleStudentFavorite(actor: Actor, eventId: string) {
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    if (
      !store.events.some(
        (e) =>
          e.id === eventId &&
          !e.archivedAt &&
          ["PUBLISHED", "FINISHED"].includes(e.status),
      )
    )
      throw new ServiceError("NOT_FOUND", "Событие недоступно.");
    const present = store.favorites.some(
      (f) => f.userId === actor.id && f.eventId === eventId,
    );
    store.favorites = store.favorites.filter(
      (f) => f.userId !== actor.id || f.eventId !== eventId,
    );
    if (!present)
      store.favorites.push({
        userId: actor.id,
        eventId,
        createdAt: new Date().toISOString(),
      });
    return { eventId, isFavorite: !present };
  });
}
export function updateCampusUser(
  actor: Actor,
  id: string,
  role: unknown,
  blocked: boolean,
  banDuration = "permanent",
) {
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
  return changeStore((store) => {
    const user = assertRole(actor, ["STUDENT"], store);
    const parsed = profileInputSchema.parse({
      name: input.name,
      currentPassword: input.currentPassword ?? "",
      password: input.password ?? "",
      passwordConfirmation: input.passwordConfirmation ?? "",
    });
    if (parsed.password) {
      if (!verifyPassword(parsed.currentPassword ?? "", user.passwordHash))
        throw new ServiceError("UNAUTHORIZED", "Текущий пароль неверен.");
      user.passwordHash = hashPassword(parsed.password);
    }
    user.name = parsed.name;
    for (const comment of store.comments.filter((c) => c.userId === user.id))
      comment.userName = user.name;
  });
}
export function updateStudentGroup(actor: Actor, id: string, group: unknown) {
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
export function createAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z
        .email()
        .max(150)
        .transform((v) => v.toLowerCase().trim()),
      password: z.string().min(8).max(128),
    })
    .parse(input);
  return changeStore((store) => {
    if (store.users.some((u) => u.email === parsed.email))
      throw new ServiceError(
        "ALREADY_EXISTS",
        "Этот email уже зарегистрирован.",
      );
    const user: CampusUser = {
      id: `user-${randomUUID()}`,
      name: parsed.name,
      email: parsed.email,
      passwordHash: hashPassword(parsed.password),
      role: "STUDENT",
      group: "",
      school: "AIU",
      blocked: false,
    };
    store.users.push(user);
    return { id: user.id, role: user.role };
  });
}
export function signIn(email: string, password: string) {
  const user = readStore().users.find(
    (u) => u.email === email.trim().toLowerCase(),
  );
  if (
    !user ||
    isCampusUserBlocked(user) ||
    password.length > 128 ||
    !verifyPassword(password, user.passwordHash)
  )
    throw new ServiceError(
      "UNAUTHORIZED",
      "Неверный email или пароль, либо аккаунт заблокирован.",
    );
  return startSession(user.id);
}
export function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  changeStore((store) => {
    store.sessions = store.sessions.filter((s) => s.expires > Date.now());
    store.sessions.push({
      hash: createHash("sha256").update(token).digest("hex"),
      userId,
      expires: Date.now() + 7 * 86400000,
    });
  });
  return token;
}
export function sessionUser(token: string) {
  const store = readStore();
  const session = store.sessions.find(
    (s) =>
      s.hash === createHash("sha256").update(token).digest("hex") &&
      s.expires > Date.now(),
  );
  return session
    ? store.users.find(
        (u) => u.id === session.userId && !isCampusUserBlocked(u),
      )
    : undefined;
}
export function revokeSession(token: string) {
  changeStore((store) => {
    store.sessions = store.sessions.filter(
      (s) => s.hash !== createHash("sha256").update(token).digest("hex"),
    );
  });
}
