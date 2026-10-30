import EventCard from "@/components/features/events/EventCard";
import EmptyState from "@/components/ui/EmptyState";
import { getEvents } from "@/lib/services/events";

export default async function HomePage() {
  const events = await getEvents({ status: "PUBLISHED" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Афиша</h1>

      {events.length === 0 ? (
        <EmptyState
          title="Событий пока нет"
          text="Загляните позже, скоро появятся новые"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}