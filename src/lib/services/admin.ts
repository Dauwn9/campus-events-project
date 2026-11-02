import * as mock from "@/lib/mocks/admin";
import { ServiceError, USE_MOCKS } from "./errors";
import type { AdminOverview } from "@/lib/mocks/admin";
import { getEvents } from "./events";

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!USE_MOCKS) {
    throw new ServiceError("INTERNAL", "Реальный сервис статистики ещё не подключён");
  }
  return mock.getAdminOverview(await getEvents());
}
