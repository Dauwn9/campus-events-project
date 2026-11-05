import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { readStore } from "@/lib/services/demo-store";
import { eventOperationAction } from "@/app/campus-actions";
import {
  PageHeading,
  Stats,
  Status,
  Empty,
} from "@/components/workspace/WorkspaceUI";
import ActionForm from "@/components/workspace/ActionForm";
import EventPoster from "@/components/events/EventPoster";
import { datePart } from "@/lib/event-design";
export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("ADMIN");
  const query = await searchParams;
  const store = readStore();
  const pending = store.events.filter((e) => e.status === "PENDING");
  const tab = query.tab === "history" ? "history" : "pending";
  const events =
    tab === "pending"
      ? pending
      : store.events.filter((e) =>
          ["PUBLISHED", "REJECTED"].includes(e.status),
        );
  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / ПУБЛИКАЦИИ"
        title="Модерация событий"
        text="Проверьте программу, время и место перед появлением события в афише."
      />
      <Stats
        items={[
          { label: "Ожидают проверки", value: pending.length },
          {
            label: "Опубликовано",
            value: store.events.filter((e) => e.status === "PUBLISHED").length,
          },
          {
            label: "Отклонено",
            value: store.events.filter((e) => e.status === "REJECTED").length,
          },
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
                <EventPoster categoryId={event.categoryId} />
                <Status value={event.status} />
              </div>
              <div className="moderation-body">
                <span className="section-kicker">
                  {
                    store.categories.find((c) => c.id === event.categoryId)
                      ?.name
                  }{" "}
                  · {store.users.find((u) => u.id === event.organizerId)?.name}
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
                {event.status === "PENDING" ? (
                  <div className="moderation-actions">
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
                  </div>
                ) : (
                  <Link className="text-link" href={`/events/${event.id}`}>
                    Открыть событие →
                  </Link>
                )}
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
