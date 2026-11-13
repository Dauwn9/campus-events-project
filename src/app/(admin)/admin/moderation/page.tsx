import Link from "next/link";
import { eventOperationAction } from "@/app/campus-actions";
import { getAdminModeration } from "@/lib/services/admin";
import {
  PageHeading,
  Stats,
  Status,
  Empty,
} from "@/components/workspace/WorkspaceUI";
import ActionForm from "@/components/workspace/ActionForm";
import EventPoster from "@/components/events/EventPoster";
import { datePart } from "@/lib/event-design";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";
export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const query = await searchParams;
  const { pending, decisions, categories, organizers, counts } =
    await getAdminModeration();
  const tab = query.tab === "history" ? "history" : "pending";
  const events = tab === "pending" ? pending : decisions;
  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / ПУБЛИКАЦИИ"
        title="Модерация событий"
        text="Проверьте программу, время и место перед появлением события в афише."
      />
      <Stats
        items={[
          { label: "Ожидают проверки", value: counts.pending },
          { label: "Опубликовано", value: counts.published },
          { label: "Отклонено", value: counts.rejected },
        ]}
      />
      <nav className="workspace-tabs" aria-label="Очередь модерации">
        <Link
          className={tab === "pending" ? "active" : ""}
          href="/admin/moderation"
        >
          На проверке · {pending.length}
        </Link>
        <Link
          className={tab === "history" ? "active" : ""}
          href="/admin/moderation?tab=history"
        >
          История решений
        </Link>
      </nav>
      {events.length ? (
        <div className="moderation-list">
          {events.map((event) => (
            <article className="moderation-card workspace-panel" key={event.id}>
              <div className="moderation-cover">
                <EventPoster
                  categoryId={event.categoryId}
                  title={event.title}
                  imageUrl={event.imageUrl}
                />
                <Status value={event.status} />
              </div>
              <div className="moderation-body">
                <span className="section-kicker">
                  {categories.find((category) => category.id === event.categoryId)
                    ?.name ?? "Без категории"}{" "}
                  · {organizers.find((user) => user.id === event.organizerId)
                    ?.name ?? "Неизвестный организатор"}
                </span>
                <h2>{event.title}</h2>
                <p>{event.description}</p>
                <div className="moderation-meta">
                  <span>
                    {datePart(event.startsAt, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Астана
                  </span>
                  <span>
                    {event.location} · {event.capacity} мест
                  </span>
                </div>
                {event.rejectionReason && (
                  <p className="form-error">
                    Причина отказа: {event.rejectionReason}
                  </p>
                )}
                <div className="moderation-actions">
                  {event.status === "PENDING" ? (
                    <>
                      <ActionForm
                        action={eventOperationAction.bind(
                          null,
                          event.id,
                          "approve",
                        )}
                      >
                        <button className="workspace-button">
                          Одобрить и опубликовать
                        </button>
                      </ActionForm>
                      <ActionForm
                        action={eventOperationAction.bind(
                          null,
                          event.id,
                          "reject",
                        )}
                      >
                        <label>
                          <span className="sr-only">
                            Причина отказа: {event.title}
                          </span>
                          <input
                            name="reason"
                            placeholder="Причина отказа"
                            required
                            minLength={5}
                            maxLength={1000}
                          />
                        </label>
                        <button className="workspace-button secondary danger">
                          Отклонить
                        </button>
                      </ActionForm>
                    </>
                  ) : (
                    <Link className="text-link" href={`/events/${event.id}`}>
                      Открыть событие →
                    </Link>
                  )}
                  <div className="flex items-center gap-2">
                    <HistoryLinkButton entityType="EVENT" entityId={event.id} />
                    <ActionForm
                      action={eventOperationAction.bind(
                        null,
                        event.id,
                        "archive",
                      )}
                      confirm="Переместить событие в архив? Его можно будет восстановить."
                    >
                      <button className="workspace-button secondary">
                        В архив
                      </button>
                    </ActionForm>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Всё проверено"
          text="Новые события появятся здесь, когда организатор отправит их на модерацию."
          href="/admin/moderation?tab=history"
          label="История решений"
        />
      )}
    </>
  );
}
