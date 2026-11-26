import { getCurrentUser, requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
import {
  registerStudent,
  cancelStudentRegistration,
  getStudentPriorityStatus,
  isPriorityEventMember,
} from "./campus";
import type {
  EventRegistrationState,
  MyRegistrationsFilter,
} from "@/lib/validators/registration";
import { ServiceError } from "./errors";
import { getPrisma } from "@/lib/prisma";
import { USE_MOCKS } from "./errors";
import { getEventById } from "./events";
import type { Event } from "@/lib/validators/event";
import { qrTokenFor, shortCodeFor } from "./tickets";

export async function getMyRegistrations(
  filter: Partial<MyRegistrationsFilter> = {},
) {
  const user = await requireRole("STUDENT");
  if (!USE_MOCKS) {
    const registrations = await getPrisma().registration.findMany({
      where: { userId: user.id },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    });
    const eventIds = [...new Set(registrations.map((registration) => registration.eventId))];
    const registrationCounts = await getPrisma().registration.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: eventIds },
        status: "CONFIRMED",
      },
      _count: { _all: true },
    });
    const countsByEvent = new Map(
      registrationCounts.map((item) => [item.eventId, item._count._all]),
    );

    return registrations
      .map((registration) => ({
        id: registration.id,
        userId: registration.userId,
        eventId: registration.eventId,
        status: registration.status,
        createdAt: registration.createdAt.toISOString(),
        qrToken: registration.qrToken,
        checkedInAt: registration.checkedInAt?.toISOString() ?? null,
        checkedInById: registration.checkedInById,
        shortCode:
          registration.status === "CONFIRMED"
            ? shortCodeFor(registration.id)
            : null,
        event: {
          id: registration.event.id,
          title: registration.event.title,
          description: registration.event.description,
          location: registration.event.location,
          startsAt: registration.event.startsAt.toISOString(),
          endsAt: registration.event.endsAt.toISOString(),
          registeredCount: countsByEvent.get(registration.eventId) ?? 0,
          capacity: registration.event.capacity,
          categoryId: registration.event.categoryId,
          organizerId: registration.event.organizerId,
          status: registration.event.status,
          imageUrl: registration.event.coverUrl ?? undefined,
        },
      }))
      .filter(
        (registration) =>
          filter.when === undefined ||
          filter.when === "all" ||
          (filter.when === "past"
            ? new Date(registration.event.endsAt) < new Date()
            : new Date(registration.event.endsAt) >= new Date()),
      )
      .sort((a, b) =>
        a.event.startsAt.localeCompare(b.event.startsAt),
      );
  }

  const store = readStore();
  return store.registrations
    .filter((r) => r.userId === user.id)
    .flatMap((r) => {
      const event = store.events.find((e) => e.id === r.eventId);
      return event ? [{ ...r, event }] : [];
    })
    .filter(
      (r) =>
        filter.when === undefined ||
        filter.when === "all" ||
        (filter.when === "past"
          ? new Date(r.event.endsAt) < new Date()
          : new Date(r.event.endsAt) >= new Date()),
    )
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}
export async function registerForEvent(id: string) {
  const user = await requireRole("STUDENT");
  if (USE_MOCKS) return registerStudent(user, id);

  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const lockedEvents = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE
    `;
    if (lockedEvents.length === 0)
      throw new ServiceError("NOT_FOUND", "Событие недоступно для записи.");

    const event = await transaction.event.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        startsAt: true,
        capacity: true,
        registrationOpensAt: true,
        priorityWindowHours: true,
      },
    });
    if (!event || event.archivedAt || event.status !== "PUBLISHED")
      throw new ServiceError("NOT_FOUND", "Событие недоступно для записи.");
    const now = new Date();
    if (event.startsAt <= now)
      throw new ServiceError(
        "EVENT_PAST",
        "Запись закрыта: событие уже началось.",
      );

    const current = await transaction.registration.findUnique({
      where: { userId_eventId: { userId: user.id, eventId: id } },
    });
    if (current && current.status !== "CANCELLED")
      throw new ServiceError(
        "ALREADY_REGISTERED",
        "Вы уже записаны на это событие.",
      );

    if (event.registrationOpensAt && event.registrationOpensAt > now)
      throw new ServiceError("NOT_OPEN_YET", "Запись ещё не открылась.");

    const priorityDeadline =
      event.registrationOpensAt && event.priorityWindowHours > 0
        ? event.registrationOpensAt.getTime() +
          event.priorityWindowHours * 60 * 60 * 1000
        : null;
    if (priorityDeadline && now.getTime() < priorityDeadline) {
      const [profile, membership] = await Promise.all([
        transaction.user.findUnique({
          where: { id: user.id },
          select: { priorityStatus: true },
        }),
        transaction.eventPriorityMember.findUnique({
          where: { eventId_userId: { eventId: id, userId: user.id } },
          select: { userId: true },
        }),
      ]);
      if (profile?.priorityStatus !== "ACTIVE" && !membership)
        throw new ServiceError(
          "NOT_OPEN_YET",
          "Пока действует приоритетная запись для активных студентов и участников списка организатора.",
        );
    }

    const confirmedCount = await transaction.registration.count({
      where: { eventId: id, status: "CONFIRMED" },
    });
    const status = confirmedCount < event.capacity ? "CONFIRMED" : "WAITLIST";
    const createdAt = new Date();
    const saved = current
      ? await transaction.registration.update({
          where: { id: current.id },
          data: {
            status,
            createdAt,
            qrToken: status === "CONFIRMED" ? qrTokenFor(current.id) : null,
            checkedInAt: null,
            checkedInById: null,
          },
        })
      : await transaction.registration.create({
          data: {
            userId: user.id,
            eventId: id,
            status,
            createdAt,
            qrToken: null,
          },
        });
    const token = status === "CONFIRMED" ? qrTokenFor(saved.id) : null;
    const registration =
      saved.qrToken === token
        ? saved
        : await transaction.registration.update({
            where: { id: saved.id },
            data: { qrToken: token },
          });
    return {
      ...registration,
      shortCode:
        registration.status === "CONFIRMED"
          ? shortCodeFor(registration.id)
          : null,
    };
  });
}
export async function cancelRegistration(id: string) {
  const user = await requireRole("STUDENT");
  if (USE_MOCKS) return cancelStudentRegistration(user, id);

  const prisma = getPrisma();
  const registrationReference = await prisma.registration.findFirst({
    where: { id, userId: user.id },
    select: { eventId: true },
  });
  if (!registrationReference)
    throw new ServiceError("NOT_FOUND", "Ваша регистрация не найдена.");

  return prisma.$transaction(async (transaction) => {
    const lockedEvents = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Event" WHERE id = ${registrationReference.eventId} FOR UPDATE
    `;
    if (lockedEvents.length === 0)
      throw new ServiceError("NOT_FOUND", "Ваша регистрация не найдена.");

    const [registration, event] = await Promise.all([
      transaction.registration.findUnique({ where: { id } }),
      transaction.event.findUnique({
        where: { id: registrationReference.eventId },
        select: { id: true, startsAt: true },
      }),
    ]);
    if (!registration || registration.userId !== user.id || !event)
      throw new ServiceError("NOT_FOUND", "Ваша регистрация не найдена.");
    if (registration.checkedInAt)
      throw new ServiceError(
        "FORBIDDEN",
        "Вход уже отмечен. Отменить посещение нельзя.",
      );
    if (event.startsAt <= new Date())
      throw new ServiceError(
        "EVENT_PAST",
        "После начала события запись нельзя отменить.",
      );

    const hadSeat = registration.status === "CONFIRMED";
    const cancelled = await transaction.registration.update({
      where: { id },
      data: { status: "CANCELLED", qrToken: null },
    });
    if (!hadSeat) return cancelled;

    const waiting = await transaction.registration.findMany({
      where: { eventId: event.id, status: "WAITLIST" },
      include: {
        user: {
          select: {
            priorityStatus: true,
            blocked: true,
            blockedUntil: true,
          },
        },
      },
    });
    const membership = await transaction.eventPriorityMember.findMany({
      where: {
        eventId: event.id,
        userId: { in: waiting.map((item) => item.userId) },
      },
      select: { userId: true },
    });
    const priorityMemberIds = new Set(membership.map((item) => item.userId));
    const now = new Date();
    const next = waiting
      .filter(
        (item) =>
          !item.user.blocked ||
          (item.user.blockedUntil !== null && item.user.blockedUntil <= now),
      )
      .sort((a, b) => {
        const aPriority =
          a.user.priorityStatus === "ACTIVE" || priorityMemberIds.has(a.userId);
        const bPriority =
          b.user.priorityStatus === "ACTIVE" || priorityMemberIds.has(b.userId);
        return (
          Number(bPriority) - Number(aPriority) ||
          a.createdAt.getTime() - b.createdAt.getTime()
        );
      })[0];
    if (next) {
      await transaction.registration.update({
        where: { id: next.id },
        data: { status: "CONFIRMED", qrToken: qrTokenFor(next.id) },
      });
    }
    return cancelled;
  });
}
export async function getEventRegistrationState(
  id: string,
): Promise<EventRegistrationState> {
  const user = await getCurrentUser();
  let event: Event;
  let mine: EventRegistrationState["myRegistration"];
  let isActive: boolean;
  let isPriorityMember: boolean;
  if (!USE_MOCKS) {
    const found = await getEventById(id);
    if (!found) throw new ServiceError("NOT_FOUND", "Событие не найдено");
    event = found;
    const [registration, profile, member] = await Promise.all([
      user.id
        ? getPrisma().registration.findFirst({
            where: { eventId: id, userId: user.id, status: { not: "CANCELLED" } },
          })
        : null,
      user.id
        ? getPrisma().user.findUnique({
            where: { id: user.id },
            select: { priorityStatus: true },
          })
        : null,
      user.id
        ? getPrisma().eventPriorityMember.findUnique({
            where: { eventId_userId: { eventId: id, userId: user.id } },
            select: { userId: true },
          })
        : null,
    ]);
    mine = registration
      ? {
          id: registration.id,
          userId: registration.userId,
          eventId: registration.eventId,
          status: registration.status,
          createdAt: registration.createdAt.toISOString(),
          qrToken: registration.qrToken,
          checkedInAt: registration.checkedInAt?.toISOString() ?? null,
          checkedInById: registration.checkedInById,
          shortCode: null,
        }
      : null;
    isActive = profile?.priorityStatus === "ACTIVE";
    isPriorityMember = Boolean(member);
  } else {
    const store = readStore();
    const found = store.events.find((e) => e.id === id);
    if (!found) throw new ServiceError("NOT_FOUND", "Событие не найдено");
    event = found;
    mine =
      store.registrations.find(
        (r) =>
          r.eventId === id && r.userId === user.id && r.status !== "CANCELLED",
      ) ?? null;
    isActive = getStudentPriorityStatus(store, user.id) === "ACTIVE";
    isPriorityMember = isPriorityEventMember(store, user.id, id);
  }
  const now = Date.now();
  const openAt = event.registrationOpensAt
    ? Date.parse(event.registrationOpensAt)
    : null;
  const priorityDeadline =
    openAt && event.priorityWindowHours
      ? openAt + event.priorityWindowHours * 3600000
      : null;
  const withinPriorityWindow =
    Boolean(openAt && priorityDeadline && now >= openAt && now < priorityDeadline);
  const canUsePriority = isActive || isPriorityMember;
  const state: EventRegistrationState["state"] =
    event.status !== "PUBLISHED" || Date.parse(event.startsAt) <= Date.now()
      ? "PAST"
      : mine?.status === "CONFIRMED"
        ? "REGISTERED"
        : mine?.status === "WAITLIST"
          ? "WAITLISTED"
          : openAt && now < openAt
            ? "NOT_OPEN_YET"
            : withinPriorityWindow && !canUsePriority
              ? "NOT_OPEN_YET"
              : event.registeredCount >= event.capacity
                ? "JOIN_WAITLIST"
                : withinPriorityWindow && canUsePriority
                  ? "PRIORITY_REGISTER"
                  : "CAN_REGISTER";
  return {
    eventId: id,
    state,
    opensAt: event.registrationOpensAt ?? null,
    seatsTotal: event.capacity,
    seatsTaken: event.registeredCount,
    myRegistration: mine,
  };
}
