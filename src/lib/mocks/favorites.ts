import { ServiceError } from "../services/errors";
import { MOCK_EVENTS } from "./registrations";
import { MOCK_USER_ID, delay, inHours, maybeFail } from "./_utils";
import type { FavoriteWithEvent, ToggleFavoriteResult } from "../validators/favorite";

const store = new Map<string, string>([
  ["evt-1", inHours(-20)],
  ["evt-4", inHours(-5)],
]);

export async function getMyFavorites(): Promise<FavoriteWithEvent[]> {
  await delay(); maybeFail();
  return [...store.entries()].map(([eventId, createdAt]) => {
    const { id, title, location, startsAt } = MOCK_EVENTS.find((e) => e.id === eventId)!;
    return { userId: MOCK_USER_ID, eventId, createdAt, event: { id, title, location, startsAt } };
  });
}

export async function getMyFavoriteIds(): Promise<string[]> {
  await delay(100, 250); maybeFail();
  return [...store.keys()];
}

export async function toggleFavorite(eventId: string): Promise<ToggleFavoriteResult> {
  await delay(150, 350); maybeFail();
  if (!MOCK_EVENTS.some((e) => e.id === eventId)) throw new ServiceError("NOT_FOUND", "Событие не найдено");
  const isFavorite = !store.has(eventId);
  if (isFavorite) store.set(eventId, inHours(0)); else store.delete(eventId);
  return { eventId, isFavorite };
}