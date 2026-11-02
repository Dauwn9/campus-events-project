import { mockEvents } from "./events";
import { delay, maybeFail } from "./_utils";
import type { Event } from "@/lib/validators/event";

export type AdminOverview = {
  totalEvents: number;
  publishedEvents: number;
  totalRegistrations: number;
  totalUsers: number;
  popularEvents: { id: string; title: string; registeredCount: number }[];
};

export async function getAdminOverview(events: Event[] = mockEvents): Promise<AdminOverview> {
  await delay();
  maybeFail();
  return {
    totalEvents: events.length,
    publishedEvents: events.filter((event) => event.status === "PUBLISHED").length,
    totalRegistrations: events.reduce(
      (total, event) => total + event.registeredCount,
      0,
    ),
    totalUsers: 24,
    popularEvents: [...events]
      .sort((a, b) => b.registeredCount - a.registeredCount)
      .slice(0, 5)
      .map(({ id, title, registeredCount }) => ({ id, title, registeredCount })),
  };
}
