import Link from "next/link";
import { eventOperationAction } from "@/app/campus-actions";
import { restoreCategoryAction } from "@/app/admin-actions";
import ActionForm from "@/components/workspace/ActionForm";
import { PageHeading, Status } from "@/components/workspace/WorkspaceUI";
import { getAdminArchivedEvents } from "@/lib/services/admin";
import { getAdminArchivedCategories } from "@/lib/services/categories";
import { datePart } from "@/lib/event-design";
import EventPoster from "@/components/events/EventPoster";
import HistoryLinkButton from "@/components/admin/HistoryLinkButton";

export default async function AdminArchivePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const [events, categories, query] = await Promise.all([
    getAdminArchivedEvents(),
    getAdminArchivedCategories(),
    searchParams,
  ]);
  const tab = query.tab === "categories" ? "categories" : "events";

  return (
    <>
      <PageHeading
        eyebrow="АДМИН-ПАНЕЛЬ / АРХИВ"
        title={tab === "events" ? "Архив событий" : "Архив категорий"}
        text="Архив скрывает записи из активных разделов, сохраняя историю и связанные данные. Их можно восстановить."
      />
      <nav className="workspace-tabs" aria-label="Тип архива">
        <Link
          className={tab === "events" ? "active" : ""}
          href="/admin/archive"
        >
          События ({events.length})
        </Link>
        <Link
          className={tab === "categories" ? "active" : ""}
          href="/admin/archive?tab=categories"
        >
          Категории ({categories.length})
        </Link>
      </nav>
      {query.error && (
        <p role="alert" className="form-error">
          Не удалось выполнить действие: {query.error}
        </p>
      )}
      {query.success === "restored" && (
        <p role="status" className="form-success">
          Категория восстановлена.
        </p>
      )}
      {tab === "events" ? (
        !events.length ? (
          <section className="workspace-panel">
            <p className="table-empty">Архив событий пока пуст.</p>
          </section>
        ) : (
          <div className="moderation-list">
            {events.map((event) => (
              <article
                className="moderation-card workspace-panel"
                key={event.id}
              >
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
                    {event.categoryName} · {event.organizerName}
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
                      В архиве с{" "}
                      {datePart(event.archivedAt!, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {event.registeredCount} регистраций
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <HistoryLinkButton entityType="EVENT" entityId={event.id} />
                    <ActionForm
                      action={eventOperationAction.bind(
                        null,
                        event.id,
                        "restore",
                      )}
                      confirm="Восстановить событие? Оно снова появится в соответствующих разделах."
                    >
                      <button className="workspace-button">
                        Восстановить событие
                      </button>
                    </ActionForm>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : !categories.length ? (
        <section className="workspace-panel">
          <p className="table-empty">Архив категорий пока пуст.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <li key={category.id}>
              <article className="workspace-panel flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{category.name}</h2>
                  <p className="text-sm text-muted">
                    {category.slug} · В архиве с{" "}
                    {datePart(category.archivedAt!, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <HistoryLinkButton entityType="CATEGORY" entityId={category.id} />
                  <form action={restoreCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <button className="workspace-button">
                      Восстановить категорию
                    </button>
                  </form>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
