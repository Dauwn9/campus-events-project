import { getCategories } from "@/lib/services/categories";
import { getEvents } from "@/lib/services/events";
import EventDiscovery from "@/components/events/EventDiscovery";
export default async function HomePage() {
  const [events, categories] = await Promise.all([getEvents({ status: "PUBLISHED" }), getCategories()]);
  return <EventDiscovery events={events} categories={categories} now={new Date().toISOString()} />;
}
