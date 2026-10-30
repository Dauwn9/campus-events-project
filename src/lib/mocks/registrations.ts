import { ServiceError } from "../services/errors";
import { MOCK_USER_ID, delay, inHours, maybeFail } from "./_utils";
import type {
  EventRegistrationState,
  MyRegistrationsFilter,
  Registration,
  RegistrationWithEvent,
} from "../validators/registration";


export const MOCK_EVENTS = [
  { id: "evt-1", title: "Хакатон «Кампус 2026»", location: "Корпус А, ауд. 301", startsAt: inHours(48), endsAt: inHours(56), seatsTotal: 40, seatsTaken: 12, opensAt: inHours(-24), priorityOnly: false, waitlist: true },
  { id: "evt-2", title: "Вечер настольных игр", location: "Коворкинг, 2 этаж", startsAt: inHours(72), endsAt: inHours(76), seatsTotal: 20, seatsTaken: 20, opensAt: inHours(-48), priorityOnly: false, waitlist: true },
  { id: "evt-3", title: "Лекция о карьере в IT", location: "Актовый зал", startsAt: inHours(120), endsAt: inHours(122), seatsTotal: 150, seatsTaken: 30, opensAt: inHours(5), priorityOnly: false, waitlist: false },
  { id: "evt-4", title: "Фестиваль первокурсников", location: "Главный двор", startsAt: inHours(96), endsAt: inHours(102), seatsTotal: 80, seatsTaken: 10, opensAt: inHours(-2), priorityOnly: true, waitlist: true },
  { id: "evt-5", title: "Кинопоказ «Начало»", location: "Малый зал", startsAt: inHours(-72), endsAt: inHours(-70), seatsTotal: 50, seatsTaken: 44, opensAt: inHours(-200), priorityOnly: false, waitlist: false },
  { id: "evt-6", title: "Турнир по киберспорту", location: "Спортзал", startsAt: inHours(200), endsAt: inHours(208), seatsTotal: 32, seatsTaken: 5, opensAt: inHours(-10), priorityOnly: false, waitlist: false },
];

const reg = (id: string, eventId: string, status: Registration["status"], extra: Partial<Registration> = {}): Registration => ({
  id, userId: MOCK_USER_ID, eventId, status, createdAt: inHours(-30),
  qrToken: status === "CONFIRMED" ? `mock.${id}.signature` : null,
  checkedInAt: null, checkedInById: null, ...extra,
});


let store: Registration[] = [
  reg("reg-1", "evt-1", "CONFIRMED"),
  reg("reg-2", "evt-2", "WAITLIST"),
  reg("reg-3", "evt-5", "CONFIRMED", { checkedInAt: inHours(-71), checkedInById: "user-org" }),
  reg("reg-4", "evt-6", "CANCELLED"),
];

const findEvent = (id: string) => {
  const e = MOCK_EVENTS.find((x) => x.id === id);
  if (!e) throw new ServiceError("NOT_FOUND", "Событие не найдено");
  return e;
};
const active = (eventId: string) =>
  store.find((r) => r.eventId === eventId && r.status !== "CANCELLED") ?? null;

export async function getEventRegistrationState(eventId: string): Promise<EventRegistrationState> {
  await delay(); maybeFail();
  const e = findEvent(eventId);
  const mine = active(eventId);
  let state: EventRegistrationState["state"] = "CAN_REGISTER";
  if (new Date(e.endsAt) < new Date()) state = "PAST";
  else if (mine?.status === "CONFIRMED") state = "REGISTERED";
  else if (mine?.status === "WAITLIST") state = "WAITLISTED";
  else if (new Date(e.opensAt) > new Date()) state = "NOT_OPEN_YET";
  else if (e.seatsTaken >= e.seatsTotal) state = e.waitlist ? "JOIN_WAITLIST" : "FULL";
  else if (e.priorityOnly) state = "PRIORITY_REGISTER";
  return {
    eventId, state,
    opensAt: state === "NOT_OPEN_YET" ? e.opensAt : null,
    seatsTotal: e.seatsTotal, seatsTaken: e.seatsTaken, myRegistration: mine,
  };
}

export async function registerForEvent(eventId: string): Promise<Registration> {
  const { state } = await getEventRegistrationState(eventId);
  if (state === "PAST") throw new ServiceError("EVENT_PAST", "Событие уже прошло");
  if (state === "REGISTERED" || state === "WAITLISTED") throw new ServiceError("ALREADY_REGISTERED", "Вы уже записаны");
  if (state === "NOT_OPEN_YET") throw new ServiceError("NOT_OPEN_YET", "Запись ещё не открыта");
  if (state === "FULL") throw new ServiceError("EVENT_FULL", "Мест нет");
  const r = reg(`reg-${Date.now()}`, eventId, state === "JOIN_WAITLIST" ? "WAITLIST" : "CONFIRMED", { createdAt: inHours(0) });
  store = [r, ...store];
  if (r.status === "CONFIRMED") findEvent(eventId).seatsTaken += 1;
  return r;
}

export async function cancelRegistration(registrationId: string): Promise<Registration> {
  await delay(); maybeFail();
  const r = store.find((x) => x.id === registrationId);
  if (!r) throw new ServiceError("NOT_FOUND", "Запись не найдена");
  if (r.status === "CONFIRMED") findEvent(r.eventId).seatsTaken -= 1;
  const cancelled = { ...r, status: "CANCELLED" as const, qrToken: null };
  store = store.map((x) => (x.id === registrationId ? cancelled : x));
  return cancelled;
}

export async function getMyRegistrations(filter: Partial<MyRegistrationsFilter> = {}): Promise<RegistrationWithEvent[]> {
  await delay(); maybeFail();
  const when = filter.when ?? "upcoming";
  return store
    .map((r) => {
      const { id, title, location, startsAt, endsAt } = findEvent(r.eventId);
      return { ...r, event: { id, title, location, startsAt, endsAt } };
    })
    .filter((r) => {
      const past = new Date(r.event.endsAt) < new Date();
      return when === "all" || (when === "past" ? past : !past);
    })
    .sort((a, b) => +new Date(a.event.startsAt) - +new Date(b.event.startsAt));
}