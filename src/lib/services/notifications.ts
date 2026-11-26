import { changeStore, readStore } from "./demo-store";
import { assertRole, type Actor } from "./campus";
import { getPrisma } from "@/lib/prisma";
import { eventInclude, toEventDto } from "./event-prisma";
import { ServiceError, USE_MOCKS } from "./errors";

export function getMyNotifications(actor: Actor) {
  if (USE_MOCKS) {
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
  {
    assertRole(actor, ["STUDENT"]);
    return getPrisma().notification.findMany({
      where: { userId: actor.id },
      include: { event: { include: eventInclude } },
      orderBy: { createdAt: "desc" },
    }).then((notifications) =>
      notifications.map(({ event, createdAt, readAt, ...notification }) => ({
        ...notification,
        createdAt: createdAt.toISOString(),
        readAt: readAt?.toISOString() ?? null,
        event: toEventDto(event),
      })),
    );
  }
}

export function markNotificationRead(actor: Actor, notificationId: string) {
  if (USE_MOCKS) {
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
  {
    assertRole(actor, ["STUDENT"]);
    return (async () => {
      const prisma = getPrisma();
      const updated = await prisma.notification.updateMany({
        where: { id: notificationId, userId: actor.id, readAt: null },
        data: { readAt: new Date() },
      });
      if (updated.count === 0) {
        const notification = await prisma.notification.findFirst({
          where: { id: notificationId, userId: actor.id },
          select: { id: true },
        });
        if (!notification)
          throw new ServiceError("NOT_FOUND", "Уведомление не найдено.");
      }
      return prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
      });
    })();
  }
}
