"use server";

import { revalidatePath } from "next/cache";
import { cancelRegistration, registerForEvent } from "@/lib/services/registrations";
import { ServiceError } from "@/lib/services/errors";

export type ActionResult = { ok: true } | { ok: false; message: string };

async function run(fn: () => Promise<unknown>, eventId: string): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    // redirect() из requireRole внутри Next — это тоже исключение, его нельзя глотать
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    if (e instanceof ServiceError) return { ok: false, message: e.message };
    return { ok: false, message: "Что-то пошло не так. Попробуйте ещё раз." };
  }
  revalidatePath("/my/registrations");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return { ok: true };
}

export async function registerAction(eventId: string): Promise<ActionResult> {
  return run(() => registerForEvent(eventId), eventId);
}

export async function cancelAction(registrationId: string, eventId: string): Promise<ActionResult> {
  return run(() => cancelRegistration(registrationId), eventId);
}
