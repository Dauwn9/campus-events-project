import { getCategories } from "@/lib/services/categories";
import { getEvents } from "@/lib/services/events";
import EventDiscovery from "@/components/events/EventDiscovery";

type SearchParams = { category?: string; q?: string; period?: string; page?: string };

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [events, categories] = await Promise.all([getEvents({ status: "PUBLISHED" }), getCategories()]);
  return (
    <EventDiscovery
      events={events}
      categories={categories}
      now={new Date().toISOString()}
      initial={{
        category: params.category,
        q: params.q,
        period: params.period === "week" || params.period === "month" ? params.period : undefined,
        page: Number.parseInt(params.page ?? "1", 10) || 1,
      }}
    />
  );
}