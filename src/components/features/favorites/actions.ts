"use server";

import { revalidatePath } from "next/cache";
import { toggleFavorite } from "@/lib/services/favorites";
import { ServiceError } from "@/lib/services/errors";

export type FavoriteResult = { ok: true } | { ok: false; message: string };

export async function toggleFavoriteAction(eventId: string): Promise<FavoriteResult> {
  try {
    await toggleFavorite(eventId);
  } catch (e) {
    // redirect() из requireRole — служебное исключение Next, его нельзя глотать
    const digest = (e as { digest?: string })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    if (e instanceof ServiceError) return { ok: false, message: e.message };
    return { ok: false, message: "Не удалось изменить избранное. Попробуйте ещё раз." };
  }
  revalidatePath("/my/favorites");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
