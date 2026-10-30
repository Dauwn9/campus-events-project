import Link from "next/link";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getEvents } from "@/lib/services/events";
import { deleteEventAction } from "@/app/(organizer)/organizer/actions";

const STATUS_LABEL = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  CANCELLED: "Отменено",
  FINISHED: "Завершено",
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

export default async function OrganizerPage() {
  // пока показываем все события; когда появятся настоящие пользователи,
  // здесь добавим фильтр по организатору
  const events = await getEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои события</h1>
        <Link
          href="/organizer/new"
          className="rounded-control bg-primary px-5 py-2.5 font-medium text-white shadow-card transition hover:bg-primary-hover"
        >
          Создать событие
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Событий пока нет" text="Создайте первое событие" />
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white p-4 shadow-card"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{event.title}</h2>
                  <Badge>{STATUS_LABEL[event.status]}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {formatDate(event.startsAt)} · {event.location} ·{" "}
                  {event.registeredCount}/{event.capacity} мест
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/organizer/${event.id}/edit`}
                  className="rounded-control border border-border px-4 py-2 text-sm font-medium transition hover:bg-primary/10 hover:text-primary"
                >
                  Редактировать
                </Link>
                <form action={deleteEventAction.bind(null, event.id)}>
                  <button
                    type="submit"
                    className="rounded-control px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
                  >
                    Удалить
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}