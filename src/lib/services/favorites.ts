import { USE_MOCKS, ServiceError } from "./errors";
import * as mock from "../mocks/favorites";
import type { FavoriteWithEvent, ToggleFavoriteResult } from "../validators/favorite";


const notReady = (): never => {
  throw new ServiceError("INTERNAL", "Реальный сервис избранного ещё не подключён");
};

export async function getMyFavorites(): Promise<FavoriteWithEvent[]> {
  return USE_MOCKS ? mock.getMyFavorites() : notReady();
}


export async function getMyFavoriteIds(): Promise<string[]> {
  return USE_MOCKS ? mock.getMyFavoriteIds() : notReady();
}

export async function toggleFavorite(eventId: string): Promise<ToggleFavoriteResult> {
  return USE_MOCKS ? mock.toggleFavorite(eventId) : notReady();
}