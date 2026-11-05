import { requireRole } from "@/lib/auth";
import { readStore } from "./demo-store";
export async function getAdminOverview() {
  await requireRole("ADMIN");
  const store = readStore();
  return {
    totalEvents: store.events.length,
    publishedEvents: store.events.filter((e) => e.status === "PUBLISHED")
      .length,
    totalRegistrations: store.registrations.filter(
      (r) => r.status === "CONFIRMED",
    ).length,
    totalUsers: store.users.length,
    popularEvents: [...store.events]
      .sort((a, b) => b.registeredCount - a.registeredCount)
      .slice(0, 5)
      .map(({ id, title, registeredCount }) => ({
        id,
        title,
        registeredCount,
      })),
  };
}
