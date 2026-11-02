import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";
import { getCategories } from "@/lib/services/categories";
import { getEvents } from "@/lib/services/events";

export default async function HomePage() {
  const [events, categories] = await Promise.all([
    getEvents({ status: "PUBLISHED" }),
    getCategories(),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Афиша</h1>
      {events.length === 0 ? (
        <EmptyState title="Событий пока нет" text="Загляните сюда позже." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`} className="block">
              <Card className="h-full space-y-3 transition hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{event.title}</h2>
                  <Badge>{categoryNames.get(event.categoryId) ?? "Мероприятие"}</Badge>
                </div>
                <p className="text-sm text-muted">{event.description}</p>
                <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
                  <span>{new Date(event.startsAt).toLocaleString("ru-RU")}</span>
                  <span>{event.location}</span>
                </div>
                <p className="text-sm">
                  Свободно мест: {Math.max(0, event.capacity - event.registeredCount)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}