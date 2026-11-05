import { getCurrentUser, requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
import { registerStudent, cancelStudentRegistration } from "./campus";
import type {
  EventRegistrationState,
  MyRegistrationsFilter,
} from "@/lib/validators/registration";
import { ServiceError } from "./errors";
export async function getMyRegistrations(
  filter: Partial<MyRegistrationsFilter> = {},
) {
  const user = await requireRole("STUDENT");
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
  return registerStudent(await requireRole("STUDENT"), id);
}
export async function cancelRegistration(id: string) {
  return cancelStudentRegistration(await requireRole("STUDENT"), id);
}
export async function getEventRegistrationState(
  id: string,
): Promise<EventRegistrationState> {
  const user = await getCurrentUser();
  const store = readStore();
  const event = store.events.find((e) => e.id === id);
  if (!event) throw new ServiceError("NOT_FOUND", "Событие не найдено");
  const mine =
    store.registrations.find(
      (r) =>
        r.eventId === id && r.userId === user.id && r.status !== "CANCELLED",
    ) ?? null;
  const state: EventRegistrationState["state"] =
    event.status !== "PUBLISHED" || Date.parse(event.startsAt) <= Date.now()
      ? "PAST"
      : mine?.status === "CONFIRMED"
        ? "REGISTERED"
        : mine?.status === "WAITLIST"
          ? "WAITLISTED"
          : event.registrationOpensAt &&
              Date.parse(event.registrationOpensAt) > Date.now()
            ? "NOT_OPEN_YET"
            : event.registeredCount >= event.capacity
              ? "JOIN_WAITLIST"
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
