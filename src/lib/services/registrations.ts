import { USE_MOCKS, ServiceError } from "./errors";
import * as mock from "../mocks/registrations";
import type {
  EventRegistrationState,
  MyRegistrationsFilter,
  Registration,
  RegistrationWithEvent,
} from "../validators/registration";



const notReady = (): never => {
  throw new ServiceError("INTERNAL", "Реальный сервис регистраций ещё не подключён");
};

/** Состояние кнопки записи на странице события. */
export async function getEventRegistrationState(eventId: string): Promise<EventRegistrationState> {
  return USE_MOCKS ? mock.getEventRegistrationState(eventId) : notReady();
}

/** Записаться (CONFIRMED или WAITLIST). Ошибки: EVENT_PAST, EVENT_FULL, ALREADY_REGISTERED, NOT_OPEN_YET. */
export async function registerForEvent(eventId: string): Promise<Registration> {
  return USE_MOCKS ? mock.registerForEvent(eventId) : notReady();
}

/** Отменить свою запись. */
export async function cancelRegistration(registrationId: string): Promise<Registration> {
  return USE_MOCKS ? mock.cancelRegistration(registrationId) : notReady();
}

/** Мои регистрации (для страницы /my/registrations). */
export async function getMyRegistrations(
  filter: Partial<MyRegistrationsFilter> = {},
): Promise<RegistrationWithEvent[]> {
  return USE_MOCKS ? mock.getMyRegistrations(filter) : notReady();
}