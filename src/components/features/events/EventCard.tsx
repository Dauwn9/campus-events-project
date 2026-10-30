import Link from "next/link";
import Badge from "@/components/ui/Badge";
import type { Event, EventStatus } from "@/lib/validators/event";

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  CANCELLED: "Отменено",
  FINISHED: "Завершено",
};

const TZ = "Asia/Almaty";

export default function EventCard({
  event,
  categoryName,
}: {
  event: Event;
  categoryName?: string;
}) {
  const start = new Date(event.startsAt);
  const day = start.toLocaleString("ru-RU", { day: "numeric", timeZone: TZ });
  const month = start.toLocaleString("ru-RU", { month: "short", timeZone: TZ });
  const time = start.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  const freeSpots = event.capacity - event.registeredCount;

  return (
    <Link href={`/events/${event.id}`} className="group block">
      <article className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card transition group-hover:-translate-y-1 group-hover:shadow-modal">
        <div className="relative h-44">
          {event.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-linear-to-br from-primary to-accent" />
          )}

          <div className="absolute left-3 top-3 rounded-control bg-white px-3 py-1 text-center shadow-card">
            <div className="text-lg font-extrabold leading-tight">{day}</div>
            <div className="text-xs font-medium uppercase text-primary">
              {month}
            </div>
          </div>

          {event.status !== "PUBLISHED" && (
            <div className="absolute right-3 top-3">
              <Badge>{STATUS_LABEL[event.status]}</Badge>
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          {categoryName && <Badge>{categoryName}</Badge>}
          <h3 className="text-lg font-bold leading-snug">{event.title}</h3>
          <p className="text-sm text-muted">
            {time} · {event.location}
          </p>
          <p
            className={`text-sm font-medium ${
              freeSpots <= 0
                ? "text-danger"
                : freeSpots <= 10
                  ? "text-accent"
                  : "text-success"
            }`}
          >
            {freeSpots <= 0
              ? "Мест нет"
              : freeSpots <= 10
                ? `Осталось ${freeSpots} мест`
                : `Свободно ${freeSpots} мест`}
          </p>
        </div>
      </article>
    </Link>
  );
}