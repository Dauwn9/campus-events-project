import { changeStore, readStore } from "./demo-store";
import { assertRole, type Actor } from "./campus";
import { ServiceError } from "./errors";

export function getMyNotifications(actor: Actor) {
  const store = readStore();
  assertRole(actor, ["STUDENT"], store);
  return store.notifications
    .filter((notification) => notification.userId === actor.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((notification) => ({
      ...notification,
      event:
        store.events.find((event) => event.id === notification.eventId) ?? null,
    }));
}

export function markNotificationRead(actor: Actor, notificationId: string) {
  return changeStore((store) => {
    assertRole(actor, ["STUDENT"], store);
    const notification = store.notifications.find(
      (item) => item.id === notificationId && item.userId === actor.id,
    );
    if (!notification) {
      throw new ServiceError("NOT_FOUND", "Уведомление не найдено.");
    }
    notification.readAt ??= new Date().toISOString();
    return notification;
  });
}
