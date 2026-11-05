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
} from "./demo-store";
import { ServiceError } from "./errors";
import { eventInputSchema, type EventInput } from "@/lib/validators/event";
import type { Role } from "@/lib/roles";

export type Actor = { id: string; role: Role };
export function assertRole(actor: Actor, roles: Role[], store = readStore()) {
  const user = store.users.find((item) => item.id === actor.id);
  if (
    !roles.includes(actor.role) ||
    !user ||
    user.blocked ||
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
export function saveCampusEvent(actor: Actor, input: EventInput, id?: string) {
  const parsed = eventInputSchema.parse(input);
  return changeStore((store) => {
    assertRole(actor, ["ORGANIZER"], store);
    if (!store.categories.some((c) => c.id === parsed.categoryId))
      throw new ServiceError("NOT_FOUND", "Выберите существующую категорию.");
    const previous = id ? ownedEvent(store, actor, id) : undefined;
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
      organizerId: actor.id,
      registeredCount: previous?.registeredCount ?? 0,
      status:
        parsed.status === "DRAFT" ? ("DRAFT" as const) : ("PENDING" as const),
      rejectionReason: undefined,
    };
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
    return event;
  });
}
export function registerStudent(actor: Actor, eventId: string) {
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    const event = store.events.find((e) => e.id === eventId);
    if (!event || event.status !== "PUBLISHED")
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
    const visits = store.registrations.filter(
      (r) => r.userId === actor.id && r.checkedInAt,
    ).length;
    if (
      event.registrationOpensAt &&
      event.priorityWindowHours &&
      Date.now() <
        Date.parse(event.registrationOpensAt) +
          event.priorityWindowHours * 3600000 &&
      visits < 3
    )
      throw new ServiceError(
        "NOT_OPEN_YET",
        "Пока действует приоритетная запись для участников с 3 посещениями.",
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
            !store.users.find((u) => u.id === r.userId)?.blocked,
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
    if (event.status !== "PUBLISHED")
      throw new ServiceError(
        "FORBIDDEN",
        "Вход доступен только на опубликованное событие.",
      );
    const code = z.string().trim().min(4).max(500).parse(rawCode);
    const registration = store.registrations.find(
      (r) =>
        r.eventId === eventId &&
        (r.shortCode === code.toUpperCase() || r.qrToken === code),
    );
    if (!registration || registration.status !== "CONFIRMED")
      throw new ServiceError(
        "NOT_FOUND",
        "Действующая запись на выбранное событие не найдена.",
      );
    const participant = store.users.find((u) => u.id === registration.userId)!;
    if (participant.blocked)
      throw new ServiceError("FORBIDDEN", "Участник заблокирован.");
    if (registration.qrToken === code) {
      const expected = Buffer.from(qrToken(store, registration.id));
      const actual = Buffer.from(code);
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw new ServiceError("FORBIDDEN", "Подпись QR недействительна.");
    }
    if (registration.checkedInAt)
      return {
        already: true,
        name: participant.name,
        at: registration.checkedInAt,
      };
    const now = Date.now();
    if (
      now < Date.parse(event.startsAt) - 3600000 ||
      now > Date.parse(event.endsAt)
    )
      throw new ServiceError(
        "NOT_OPEN_YET",
        "Вход открыт за час до начала и до окончания события.",
      );
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
        (e) => e.id === eventId && ["PUBLISHED", "FINISHED"].includes(e.status),
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
  role: Role,
  blocked: boolean,
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
    user.role = validated;
    user.blocked = blocked;
    return { id: user.id, role: user.role, blocked: user.blocked };
  });
}
export function updateStudentProfile(
  actor: Actor,
  input: {
    name: string;
    group: string;
    school: string;
    currentPassword?: string;
    password?: string;
  },
) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      group: z.string().trim().max(40),
      school: z.string().trim().max(120),
      currentPassword: z.string().optional(),
      password: z.string().optional(),
    })
    .parse(input);
  return changeStore((store) => {
    const user = assertRole(actor, ["STUDENT"], store);
    if (parsed.password) {
      if (parsed.password.length < 8 || parsed.password.length > 128)
        throw new ServiceError(
          "FORBIDDEN",
          "Пароль должен содержать от 8 до 128 символов.",
        );
      if (!verifyPassword(parsed.currentPassword ?? "", user.passwordHash))
        throw new ServiceError("FORBIDDEN", "Текущий пароль неверен.");
      user.passwordHash = hashPassword(parsed.password);
    }
    user.name = parsed.name;
    user.group = parsed.group;
    user.school = parsed.school;
    for (const comment of store.comments.filter((c) => c.userId === user.id))
      comment.userName = user.name;
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
    user.blocked ||
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
    ? store.users.find((u) => u.id === session.userId && !u.blocked)
    : undefined;
}
export function revokeSession(token: string) {
  changeStore((store) => {
    store.sessions = store.sessions.filter(
      (s) => s.hash !== createHash("sha256").update(token).digest("hex"),
    );
  });
}
