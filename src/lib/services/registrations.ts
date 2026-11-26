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
import { ServiceError, USE_MOCKS } from "./errors";
import { getPrisma } from "@/lib/prisma";
import { eventInclude, toEventDto } from "./event-prisma";

function registrationDto(registration: {
  id: string;
  userId: string;
  eventId: string;
  status: "CONFIRMED" | "WAITLIST" | "CANCELLED";
  createdAt: Date;
  qrToken: string | null;
  checkedInAt: Date | null;
  checkedInById: string | null;
  shortCode: string | null;
}) {
  return {
    ...registration,
    createdAt: registration.createdAt.toISOString(),
    checkedInAt: registration.checkedInAt?.toISOString() ?? null,
  };
}

export async function getMyRegistrations(
  filter: Partial<MyRegistrationsFilter> = {},
) {
  const user = await requireRole("STUDENT");
  if (USE_MOCKS) {
    const store = readStore();
    return store.registrations
      .filter((registration) => registration.userId === user.id)
      .flatMap((registration) => {
        const event = store.events.find((item) => item.id === registration.eventId);
        return event ? [{ ...registration, event }] : [];
      })
      .filter(
        (registration) =>
          filter.when === undefined ||
          filter.when === "all" ||
          (filter.when === "past"
            ? new Date(registration.event.endsAt) < new Date()
            : new Date(registration.event.endsAt) >= new Date()),
      )
      .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  }

  const registrations = await getPrisma().registration.findMany({
    where: { userId: user.id },
    include: { event: { include: eventInclude } },
    orderBy: { event: { startsAt: "asc" } },
  });
  const now = Date.now();
  return registrations
    .filter((registration) =>
      filter.when === undefined ||
      filter.when === "all" ||
      (filter.when === "past"
        ? registration.event.endsAt.getTime() < now
        : registration.event.endsAt.getTime() >= now),
    )
    .map((registration) => ({
      ...registrationDto(registration),
      event: toEventDto(registration.event),
    }));
}
export async function registerForEvent(id: string) {
  return registerStudent(await requireRole("STUDENT"), id);
}
export async function cancelRegistration(id: string) {
  return cancelStudentRegistration(await requireRole("STUDENT"), id);
}
export async function getEventRegistrationState(
  id: string,
): Promise<EventRegistrationState> {
  const user = await getCurrentUser();
  if (USE_MOCKS) {
    return getMockEventRegistrationState(id, user.id, readStore());
  }
  {
    const prisma = getPrisma();
    const eventRecord = await prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!eventRecord)
      throw new ServiceError("NOT_FOUND", "Событие не найдено");
    const event = toEventDto(eventRecord);
    const [mine, userRecord, visits] = await Promise.all([
      user.id
        ? prisma.registration.findUnique({
            where: { userId_eventId: { userId: user.id, eventId: id } },
          })
        : Promise.resolve(null),
      user.id
        ? prisma.user.findUnique({
            where: { id: user.id },
            select: { priorityStatus: true },
          })
        : Promise.resolve(null),
      user.id
        ? prisma.registration.count({
            where: { userId: user.id, checkedInAt: { not: null } },
          })
        : Promise.resolve(0),
    ]);
    const now = Date.now();
    const openAt = event.registrationOpensAt
      ? Date.parse(event.registrationOpensAt)
      : null;
    const priorityDeadline =
      openAt && event.priorityWindowHours
        ? openAt + event.priorityWindowHours * 3600000
        : null;
    const withinPriorityWindow = Boolean(
      openAt && priorityDeadline && now >= openAt && now < priorityDeadline,
    );
    const priorityMember = user.id
      ? await prisma.eventPriorityMember.findUnique({
          where: { eventId_userId: { eventId: id, userId: user.id } },
          select: { userId: true },
        })
      : null;
    const activeMine = mine?.status === "CANCELLED" ? null : mine;
    const canUsePriority =
      userRecord?.priorityStatus === "ACTIVE" || visits >= 3 || !!priorityMember;
    const state: EventRegistrationState["state"] =
      event.status !== "PUBLISHED" || Date.parse(event.startsAt) <= now
        ? "PAST"
        : activeMine?.status === "CONFIRMED"
          ? "REGISTERED"
          : activeMine?.status === "WAITLIST"
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
      myRegistration: activeMine ? registrationDto(activeMine) : null,
    };
  }
}

function getMockEventRegistrationState(
  id: string,
  userId: string,
  store: ReturnType<typeof readStore>,
): EventRegistrationState {
  const event = store.events.find((item) => item.id === id);
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено");
  const mine =
    store.registrations.find(
      (registration) =>
        registration.eventId === id &&
        registration.userId === userId &&
        registration.status !== "CANCELLED",
    ) ?? null;
  const now = Date.now();
  const openAt = event.registrationOpensAt
    ? Date.parse(event.registrationOpensAt)
    : null;
  const priorityDeadline =
    openAt && event.priorityWindowHours
      ? openAt + event.priorityWindowHours * 3600000
      : null;
  const withinPriorityWindow = Boolean(
    openAt && priorityDeadline && now >= openAt && now < priorityDeadline,
  );
  const isActive = getStudentPriorityStatus(store, userId) === "ACTIVE";
  const isPriorityMember = isPriorityEventMember(store, userId, id);
  const canUsePriority = isActive || isPriorityMember;
  const state: EventRegistrationState["state"] =
    event.status !== "PUBLISHED" || Date.parse(event.startsAt) <= now
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
