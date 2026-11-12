import { getCategories } from "@/lib/services/categories";
import { getEvents } from "@/lib/services/events";
import EventDiscovery from "@/components/events/EventDiscovery";
import ErrorState from "@/components/ui/ErrorState";

type SearchParams = { category?: string; q?: string; period?: string; from?: string; to?: string; page?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  let events;
  let categories;

  try {
    [events, categories] = await Promise.all([getEvents({ status: "PUBLISHED" }), getCategories()]);
  } catch {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <ErrorState
          title="Не удалось загрузить афишу"
          text="Список мероприятий временно недоступен. Попробуйте обновить страницу или повторить позже."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <EventDiscovery
      events={events}
      categories={categories}
      now={new Date().toISOString()}
      initial={{
        category: params.category,
        q: params.q,
        period: params.period === "week" || params.period === "month" ? params.period : undefined,
        from: params.from,
        to: params.to,
        page: Number.parseInt(params.page ?? "1", 10) || 1,
      }}
    />
  );
}