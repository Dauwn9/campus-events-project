import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getEventById } from "@/lib/services/events";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) notFound();

  const freeSpots = event.capacity - event.registeredCount;

  return (
    <div className="space-y-6">
      {event.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt={event.title}
          className="h-64 w-full rounded-card object-cover"
        />
      )}

      <div className="space-y-2">
        {event.status !== "PUBLISHED" && <Badge>{event.status}</Badge>}
        <h1 className="text-3xl font-bold">{event.title}</h1>
      </div>

      <div className="space-y-1 text-muted">
        <p>Начало: {formatDate(event.startsAt)}</p>
        <p>Окончание: {formatDate(event.endsAt)}</p>
        <p>Место: {event.location}</p>
        <p>
          {freeSpots > 0
            ? `Свободно мест: ${freeSpots} из ${event.capacity}`
            : "Мест нет"}
        </p>
      </div>

      <p className="whitespace-pre-line">{event.description}</p>

      <Button disabled={freeSpots <= 0}>Записаться</Button>
    </div>
  );
}