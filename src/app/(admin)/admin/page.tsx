import Link from "next/link";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminOverview } from "@/lib/services/admin";

const metrics = [
  { key: "totalEvents", label: "Всего событий" },
  { key: "publishedEvents", label: "Опубликовано" },
  { key: "totalRegistrations", label: "Регистраций" },
  { key: "totalUsers", label: "Пользователей" },
] as const;

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Обзор</h1>
        <p className="mt-1 text-sm text-muted">Показаны демонстрационные данные.</p>
      </div>
      <section
        aria-label="Ключевые показатели"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <Card key={metric.key}>
            <p className="text-sm text-muted">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold">{overview[metric.key]}</p>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Популярные события</h2>
        {overview.popularEvents.length === 0 ? (
          <EmptyState title="Событий пока нет" />
        ) : (
          <div className="space-y-3">
            {overview.popularEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Card className="flex items-center justify-between gap-4">
                  <span className="font-medium">{event.title}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {event.registeredCount} записей
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
