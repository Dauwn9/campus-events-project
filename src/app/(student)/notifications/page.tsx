import Link from "next/link";
import { markNotificationReadAction } from "@/app/social-actions";
import { requireRole } from "@/lib/auth";
import { getMyNotifications } from "@/lib/services/notifications";
import { datePart } from "@/lib/event-design";
import { Empty, PageHeading, Status } from "@/components/workspace/WorkspaceUI";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [student, query] = await Promise.all([
    requireRole("STUDENT"),
    searchParams,
  ]);
  const notifications = getMyNotifications(student);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title="Уведомления"
        text={`${unreadCount} непрочитанных уведомлений о событиях.`}
      />
      {query.success === "read" && (
        <p role="status" className="form-success">
          Уведомление отмечено прочитанным.
        </p>
      )}
      {query.error && (
        <p role="alert" className="form-error">
          Уведомление не найдено или недоступно.
        </p>
      )}
      {notifications.length === 0 ? (
        <section className="workspace-panel">
          <Empty
            title="Новых уведомлений пока нет"
            text="Здесь появятся сообщения об отмене или важных изменениях событий, на которые вы записаны."
          />
        </section>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`workspace-panel space-y-3 ${
                notification.readAt ? "opacity-75" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{notification.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {notification.message}
                  </p>
                  <time
                    className="mt-2 block text-xs text-muted"
                    dateTime={notification.createdAt}
                  >
                    {datePart(notification.createdAt, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {!notification.readAt && (
                  <span className="status-tag">Новое</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {notification.event && (
                  <>
                    <Status value={notification.event.status} />
                    <Link
                      className="text-link"
                      href={`/events/${notification.event.id}`}
                    >
                      Открыть событие →
                    </Link>
                  </>
                )}
                {!notification.readAt && (
                  <form action={markNotificationReadAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <button className="workspace-button secondary">
                      Отметить прочитанным
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
