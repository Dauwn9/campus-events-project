import { z } from "zod";



export const registrationStatusSchema = z.enum(["CONFIRMED", "WAITLIST", "CANCELLED"]);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;


export const registrationEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  location: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});
export type RegistrationEvent = z.infer<typeof registrationEventSchema>;

export const registrationSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  eventId: z.string().min(1),
  status: registrationStatusSchema,
  createdAt: z.string().datetime(),
  qrToken: z.string().nullable(), 
  checkedInAt: z.string().datetime().nullable(),
  checkedInById: z.string().nullable(),
});
export type Registration = z.infer<typeof registrationSchema>;

export const registrationWithEventSchema = registrationSchema.extend({
  event: registrationEventSchema,
});
export type RegistrationWithEvent = z.infer<typeof registrationWithEventSchema>;

// --- Входные данные ---
export const registerForEventInputSchema = z.object({ eventId: z.string().min(1) });
export type RegisterForEventInput = z.infer<typeof registerForEventInputSchema>;

export const cancelRegistrationInputSchema = z.object({ registrationId: z.string().min(1) });
export type CancelRegistrationInput = z.infer<typeof cancelRegistrationInputSchema>;

export const myRegistrationsFilterSchema = z.object({
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
});
export type MyRegistrationsFilter = z.infer<typeof myRegistrationsFilterSchema>;

// --- Состояние кнопки на странице события ---
export const registrationButtonStateSchema = z.enum([
  "CAN_REGISTER",       // «Записаться»
  "PRIORITY_REGISTER",  // «Приоритетная запись»
  "JOIN_WAITLIST",      // «Встать в очередь»
  "NOT_OPEN_YET",       // «Запись откроется в …»
  "REGISTERED",         // «Вы записаны»
  "WAITLISTED",         // «Вы в очереди»
  "FULL",               // «Мест нет» (без листа ожидания)
  "PAST",               // «Прошло»
]);
export type RegistrationButtonState = z.infer<typeof registrationButtonStateSchema>;

export const eventRegistrationStateSchema = z.object({
  eventId: z.string(),
  state: registrationButtonStateSchema,
  opensAt: z.string().datetime().nullable(), // для NOT_OPEN_YET
  seatsTotal: z.number().int().nonnegative(),
  seatsTaken: z.number().int().nonnegative(),
  myRegistration: registrationSchema.nullable(),
});
export type EventRegistrationState = z.infer<typeof eventRegistrationStateSchema>;